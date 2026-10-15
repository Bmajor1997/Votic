import { parse } from "parse5";
/* global Response */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable, pipeline } from "node:stream";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";

const MAX_HTML_BYTES = 2_000_000;
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);
export class WebImportError extends Error {}
function private_ip(address) {
  const family = isIP(address);
  if (!family) return true;
  if (family === 6) {
    const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1).toLowerCase();
    // Reject mapped/compatible IPv4, local, link-local and multicast IPv6.
    // Public IPv6 unicast currently uses 2000::/3. Never let mapped private IPv4 bypass this check.
    return !/^[23][0-9a-f]{3}:/.test(canonical) ||
      canonical.startsWith("2002:") || canonical.startsWith("2001:0:") || canonical.startsWith("2001::");
  }
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && [18, 19].includes(b));
}
async function resolve_public_url(value, lookupImpl) {
  let url;
  try {
    const trimmed = value.trim();
    // "example.com:8080/news" has a port, not a scheme; only a letter-led scheme ("http:", "javascript:") counts.
    url = new URL(/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch { throw new WebImportError("Enter a valid webpage address."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new WebImportError("Only http and https webpage links are supported.");
  if (url.username || url.password) throw new WebImportError("Webpage links cannot contain sign-in credentials.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) throw new WebImportError("That webpage address is not public.");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] :
    await lookupImpl(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => private_ip(item.address))) throw new WebImportError("That webpage address is not public.");
  return { url, addresses };
}
export async function validate_public_url(value, lookupImpl = lookup) {
  return (await resolve_public_url(value, lookupImpl)).url;
}

/** Keep the hostname for TLS verification/Host, but connect only to an address already validated. */
export async function fetch_public_page(url, options, addresses, requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest) {
  // Try every validated address: a DNS record can list IPv6 first on an IPv4-only server.
  // Each connection remains pinned, including retries, so DNS rebinding cannot bypass validation.
  let lastError;
  for (const pinned of [...addresses].sort((a, b) => a.family - b.family)) {
    if (options.signal?.aborted) throw options.signal.reason || new Error("Webpage download aborted.");
    try {
      return await new Promise((resolve, reject) => {
        const request = requestImpl(url, {
          ...options,
          family: pinned.family,
          autoSelectFamily: false,
          lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
        }, (response) => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) for (const item of value) headers.append(name, item);
            else if (value !== undefined) headers.set(name, value);
          }
          resolve(new Response(Readable.toWeb(response), { status: response.statusCode, headers }));
        });
        request.on("error", reject);
        request.end();
      });
    } catch (error) { lastError = error; }
  }
  throw lastError || new WebImportError("The webpage could not be downloaded.");
}

const IGNORED_TAGS = new Set(["script", "style", "noscript", "svg", "canvas", "iframe", "form", "nav", "footer", "aside", "button", "select", "template"]);
const BLOCK_TAGS = new Set(["p", "div", "section", "article", "main", "header", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "tr", "dd", "dt"]);
function page_chrome(node) {
  const attrs = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
  return IGNORED_TAGS.has(node.tagName) || attrs.get("role") === "navigation" ||
    attrs.has("hidden") || attrs.get("aria-hidden") === "true" || attrs.get("role") === "note" ||
    // Footnote markers such as [1] are small superscripts; "reference" elsewhere can be real content.
    (node.tagName === "sup" && /(?:^|\s)reference(?:\s|$)/i.test(attrs.get("class") || "")) ||
    /(?:^|\s)(?:vector-page-toolbar|vector-header|vector-toc|mw-editsection|p-lang-btn|p-personal)(?:\s|$)/i.test(`${attrs.get("id") || ""} ${attrs.get("class") || ""}`) ||
    // Things a reader skips: citation lists and [1] markers, review/status boxes, short descriptions, fact boxes,
    // "For other uses…" notes, sidebars, navigation boxes, category links, and anything marked not for print.
    /(?:^|\s)(?:reflist|references|mw-cite-backlink|mw-references-wrap|mw-fr-[\w-]+|flaggedrevs[\w-]*|mw-indicators|shortdescription|infobox[\w-]*|hatnote|sidebar[\w-]*|vertical-navbox|ambox[\w-]*|toc|navbox[\w-]*|catlinks|printfooter|noprint|metadata|mw-jump-link|mw-empty-elt)(?:\s|$)/i.test(`${attrs.get("id") || ""} ${attrs.get("class") || ""}`);
}
/** Back-matter headings. Everything after one is citations and links, not something to read aloud. */
const BACK_MATTER = /^(?:references|citations|footnotes|bibliography|works cited|further reading|external links)$/i;
// "Notes", "Sources" and "See also" can be real sections (meeting notes, say), so they only count as back matter
// when they run straight into one of the headings above, as on Wikipedia.
const MAYBE_BACK_MATTER = /^(?:notes|sources|see also|notes and references)$/i;
const heading_title = (node) => plain_text(node).replace(/\[edit\]/gi, "").trim();
function back_matter_heading(node) {
  return ["h2", "h3"].includes(node.tagName) && BACK_MATTER.test(heading_title(node));
}
function section_headings(node, found = []) {
  if (["h2", "h3"].includes(node.tagName)) found.push(node);
  else if (!page_chrome(node)) for (const child of node.childNodes || []) section_headings(child, found);
  return found;
}
/** Notes, Sources and See also headings that lead straight into back matter, so reading stops at them instead. */
function back_matter_run(region) {
  const headings = section_headings(region), run = new Set();
  headings.forEach((heading, index) => {
    if (!back_matter_heading(heading)) return;
    for (let before = index - 1; before >= 0 && MAYBE_BACK_MATTER.test(heading_title(headings[before])); before -= 1)
      run.add(headings[before]);
  });
  return run;
}
function find_tags(node, tag, found = []) {
  if (node.tagName === tag) found.push(node);
  else if (!page_chrome(node)) for (const child of node.childNodes || []) find_tags(child, tag, found);
  return found;
}
function find_tag(node, tag) {
  return find_tags(node, tag)[0] || null;
}
function plain_text(node) {
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes || []).map(plain_text).join("");
}
const CONTAINERS = new Set(["article", "main", "body", "html"]);
/**
 * A block made almost entirely of short links: a site menu, language list, or table of contents. Judged by
 * links, not by line length, so short lists of real content (a checklist, steps, headings) always stay.
 */
function link_menu(node) {
  if (!node.tagName || CONTAINERS.has(node.tagName)) return false;
  const links = find_tags(node, "a").map((link) => plain_text(link).trim()).filter(Boolean);
  if (links.length < 3) return false;
  const visible = (text) => text.replace(/[\s•|·,]+/g, "").length;
  const linkChars = links.reduce((total, text) => total + visible(text), 0);
  const words = links.reduce((total, text) => total + text.split(/\s+/).length, 0);
  return linkChars >= visible(plain_text(node)) * 0.8 && words / links.length <= 4;
}
/** Text in reading order. Stops at the first back-matter heading (`state.ended`), once there's text to read. */
function readable_text(node, state = { ended: false, chars: 0, run: new Set() }) {
  if (state.ended) return "";
  if (node.nodeName === "#text") {
    state.chars += node.value.trim().length;
    return node.value;
  }
  if (page_chrome(node) || link_menu(node)) return "";
  if (state.chars > 0 && (back_matter_heading(node) || state.run.has(node))) {
    state.ended = true;
    return "";
  }
  if (["br", "hr"].includes(node.tagName)) return "\n";
  const text = (node.childNodes || []).map((child) => readable_text(child, state)).join("");
  if (node.tagName === "li") return `\n• ${text}\n`;
  if (["td", "th"].includes(node.tagName)) return `${text} `;
  return BLOCK_TAGS.has(node.tagName) ? `\n${text}\n` : text;
}
export function clean_webpage_html(html) {
  // Parse real elements: strings/comments inside scripts must never choose the article region.
  const document = parse(html);
  const titleNode = find_tag(document, "title");
  const title = (titleNode ? readable_text(titleNode) : "").replace(/\s+/g, " ").trim().slice(0, 200);
  // The longest article is the story; teasers and related posts are shorter.
  const articles = find_tags(document, "article").map((node) => [node, readable_text(node).trim().length]);
  const article = articles.sort((a, b) => b[1] - a[1])[0]?.[0];
  const region = article || find_tag(document, "main") || find_tag(document, "body") || document;
  const source = readable_text(region, { ended: false, chars: 0, run: back_matter_run(region) }).replace(/\r/g, "").replace(/[ \t\u00a0]+/g, " ").replace(/ *\n */g, "\n").trim();
  const kept = source.split("\n").map((line) => line.trim()).filter(Boolean)
    .filter((line) => !/^(cookie|accept all|privacy settings|sign up|subscribe|advertisement|skip to content|jump to content)$/i.test(line));
  return { title, text: kept.join("\n\n").slice(0, 400_000) };
}
export async function import_public_webpage(value, { fetchImpl = fetch_public_page, lookupImpl = lookup, timeoutMs = 15_000 } = {}) {
  let target = await resolve_public_url(value, lookupImpl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    let response, reader, timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new WebImportError("The webpage took too long to download. Try again."));
      }, timeoutMs);
    });
    const download = async () => {
      response = await fetchImpl(target.url, {
        redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "Votic/1.0 webpage importer", "Accept": "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
      }, target.addresses);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new WebImportError("The webpage redirected too many times.");
        return { redirect: location };
      }
      if (!response.ok) throw new WebImportError("The webpage could not be downloaded.");
      const type = (response.headers.get("content-type") || "").toLowerCase();
      if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new WebImportError("That link does not point to a readable webpage.");
      const encoding = (response.headers.get("content-encoding") || "identity").toLowerCase();
      const decoders = { gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress };
      if (encoding !== "identity" && !Object.hasOwn(decoders, encoding)) throw new WebImportError("That webpage uses an unsupported content encoding.");
      if (Number(response.headers.get("content-length") || 0) > MAX_HTML_BYTES) throw new WebImportError("That webpage is too large to import.");
      if (!response.body) throw new WebImportError("The webpage could not be downloaded.");
      // Bound decoded HTML too, so compressed responses cannot bypass the byte cap.
      let body = response.body;
      if (encoding !== "identity") {
        const decoder = decoders[encoding]();
        // The body reader receives decoding errors. Pipeline also handles cancellation
        // errors on the upstream stream, avoiding uncaught errors after reader.cancel().
        pipeline(Readable.fromWeb(response.body), decoder, () => {});
        body = Readable.toWeb(decoder);
      }
      reader = body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > MAX_HTML_BYTES) throw new WebImportError("That webpage is too large to import.");
        chunks.push(Buffer.from(chunk));
      }
      const cleaned = clean_webpage_html(Buffer.concat(chunks, size).toString("utf8"));
      if (cleaned.text.length < 80) throw new WebImportError("Votic could not find enough readable article text on that webpage.");
      return { ...cleaned, url: target.url.toString() };
    };
    let result;
    try { result = await Promise.race([download(), timeout]); }
    finally {
      clearTimeout(timer);
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
      else if (response?.body) void response.body.cancel().catch(() => {});
    }
    if (!result.redirect) return result;
    target = await resolve_public_url(new URL(result.redirect, target.url).toString(), lookupImpl);
  }
  throw new WebImportError("The webpage could not be imported.");
}
