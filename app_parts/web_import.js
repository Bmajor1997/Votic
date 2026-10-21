import { decode_document_bytes } from "../apps/mobile/src/documents/textEncoding.js";
import { parse } from "parse5";
import { parse_document_isolated } from "./document_parser.js";
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
/**
 * Two or more links pasted into one box ("…/Wallacehttps://www.bbc.co.uk/…") would otherwise be read as one long
 * address on the first site. A link inside a query string or fragment (`?url=https://…`) is still one address.
 */
export function has_several_addresses(value) {
  const location = String(value).split(/[?#]/, 1)[0];
  return (location.match(/https?:\/\//gi) || []).length > 1;
}
async function resolve_public_url(value, lookupImpl) {
  let url;
  if (has_several_addresses(value))
    throw new WebImportError("That box has more than one webpage address. Keep just one link, then try again.");
  try {
    const trimmed = value.trim();
    // "example.com:8080/news" has a port, not a scheme; only a letter-led scheme ("http:", "javascript:") counts.
    url = new URL(/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch { throw new WebImportError("Enter a valid webpage address."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new WebImportError("Only http and https webpage links are supported.");
  if (url.username || url.password) throw new WebImportError("Webpage links cannot contain sign-in credentials.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) throw new WebImportError("That webpage address is not public.");
  let addresses;
  try {
    addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] :
      await lookupImpl(hostname, { all: true, verbatim: true });
  } catch (error) { throw network_failure(error); }
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
/**
 * Structure markers. Newlines in HTML source are formatting, not paragraphs (an essay wrapped at 70 columns would
 * otherwise become hundreds of one-line passages), so source whitespace collapses to a space and real structure is
 * carried by these: PARAGRAPH for blocks, list items and doubled <br>, LINE for a single <br> or a line of <pre>.
 */
const PARAGRAPH = String.fromCharCode(0x2029), LINE = String.fromCharCode(0x2028);
const SPACE_RUN = new RegExp(`[^\\S${LINE}${PARAGRAPH}]+`, "g");
const DOUBLE_BREAK = new RegExp(`(?: ?${LINE} ?){2,}`, "g");
/** A text node's words: source whitespace becomes one space, except that <pre> keeps its lines. */
function text_value(value, pre) {
  return pre ? value.replace(/\r\n?|\n/g, LINE) : value.replace(/\s+/g, " ");
}
/** Text in reading order. Stops at the first back-matter heading (`state.ended`), once there's text to read. */
function readable_text(node, state = { ended: false, chars: 0, run: new Set() }, pre = false) {
  if (state.ended) return "";
  if (node.nodeName === "#text") {
    state.chars += node.value.trim().length;
    return text_value(node.value, pre);
  }
  if (page_chrome(node) || link_menu(node)) return "";
  if (state.chars > 0 && (back_matter_heading(node) || state.run.has(node))) {
    state.ended = true;
    return "";
  }
  if (node.tagName === "br") return LINE;
  if (node.tagName === "hr") return PARAGRAPH;
  const inside = pre || node.tagName === "pre";
  const text = (node.childNodes || []).map((child) => readable_text(child, state, inside)).join("");
  if (node.tagName === "li") return `${PARAGRAPH}• ${text}${PARAGRAPH}`;
  if (["td", "th"].includes(node.tagName)) return `${text} `;
  return BLOCK_TAGS.has(node.tagName) ? `${PARAGRAPH}${text}${PARAGRAPH}` : text;
}
const CLUTTER = /^(cookie|accept all|privacy settings|sign up|subscribe|advertisement|skip to content|jump to content)$/i;
/** Paragraphs separated by a blank line; a single <br> stays a line break inside its paragraph. */
function structured_text(source) {
  return source
    .replace(SPACE_RUN, " ")
    // Legacy pages separate paragraphs with <br><br> instead of <p>.
    .replace(DOUBLE_BREAK, PARAGRAPH)
    .split(PARAGRAPH)
    .map((paragraph) => paragraph.split(LINE).map((line) => line.trim()).filter(Boolean).join("\n"))
    .filter((paragraph) => paragraph && !CLUTTER.test(paragraph))
    .join("\n\n");
}
function validate_html_tree(root) {
  const pending = [{ node: root, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (++count > 20_000 || depth > 128)
      throw new WebImportError("That webpage is too complex to import safely.");
    for (const child of node.childNodes || []) pending.push({ node: child, depth: depth + 1 });
  }
}
export async function clean_webpage_isolated(html, { signal, timeoutMs = 5000 } = {}) {
  try {
    const result = await parse_document_isolated("webpage", Buffer.from(html), {
      signal, timeoutMs, workerUrl: new URL("./web_import_worker.js", import.meta.url),
    });
    return JSON.parse(result);
  } catch (error) {
    throw new WebImportError(error.code === "PARSER_TIMEOUT"
      ? "That webpage took too long to process. Try a simpler page."
      : "That webpage could not be processed safely. Try a simpler page.");
  }
}
export function clean_webpage_html(html) {
  if (typeof html !== "string" || Buffer.byteLength(html) > MAX_HTML_BYTES)
    throw new WebImportError("That webpage is too large to import.");
  // Parse real elements: strings/comments inside scripts must never choose the article region.
  const document = parse(html);
  validate_html_tree(document);
  const titleNode = find_tag(document, "title");
  const title = (titleNode ? readable_text(titleNode) : "").replace(/\s+/g, " ").trim().slice(0, 200);
  // The longest article is the story; teasers and related posts are shorter.
  const articles = find_tags(document, "article").map((node) => [node, readable_text(node).trim().length]);
  const article = articles.sort((a, b) => b[1] - a[1])[0]?.[0];
  const region = article || find_tag(document, "main") || find_tag(document, "body") || document;
  const text = structured_text(readable_text(region, { ended: false, chars: 0, run: back_matter_run(region) }));
  if (text.length > 400_000) throw new WebImportError("That webpage contains too much text to import completely.");
  return { title, text };
}
async function read_html_stream(reader) {
  const chunks = [];
  let size = 0;
  for (let reads = 0; ; reads += 1) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    if (reads >= 32_000 || !chunk.byteLength) throw new WebImportError("That webpage stream is too fragmented to import safely.");
    size += chunk.byteLength;
    if (size > MAX_HTML_BYTES) throw new WebImportError("That webpage is too large to import.");
    chunks.push(Buffer.from(chunk));
  }
  try { return decode_document_bytes(Buffer.concat(chunks, size)); }
  catch { throw new WebImportError("This webpage’s text encoding could not be read safely. Save or export it as UTF-8 HTML or text, then import that file."); }
}

/** An RFC 9110 product token with a comment. Votic names itself honestly and never poses as a browser. */
export const WEB_IMPORT_USER_AGENT = "Votic/1.0 (webpage importer)";
const TRY_ELSEWHERE = "Try another page or import a document instead.";
const JAVASCRIPT_PAGE = `This webpage needs a full web browser to show its text, so Votic can't import it. ${TRY_ELSEWHERE}`;

/** How long a 429's Retry-After asks to wait, in seconds, from either a number of seconds or an HTTP date. */
export function retry_after_seconds(value, now = Date.now()) {
  const text = String(value || "").trim();
  if (/^\d+$/.test(text)) return Number(text);
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, Math.round((date - now) / 1000)) : null;
}
function wait_phrase(seconds) {
  if (seconds === null) return "Try again later.";
  if (seconds < 90) return "Try again in a minute.";
  if (seconds < 3600) return `Try again in about ${Math.round(seconds / 60)} minutes.`;
  return "Try again later.";
}
/**
 * The user-facing reason a webpage response can't be imported. Each message says only what the response shows:
 * a 403 says access was denied; an unexplained failure never claims the site blocked Votic.
 */
export function http_failure(response, now = Date.now()) {
  const { status } = response;
  if ([401, 403].includes(status))
    return /challenge/i.test(response.headers.get("cf-mitigated") || "")
      ? `This website asked for a browser check that Votic can't complete. ${TRY_ELSEWHERE}`
      : `This website denied Votic access. ${TRY_ELSEWHERE}`;
  if ([404, 410].includes(status)) return "That webpage wasn't found. Check the address and try again.";
  if (status === 429)
    return `This website is limiting requests right now. ${wait_phrase(retry_after_seconds(response.headers.get("retry-after"), now))}`;
  if (status >= 500) return "That website is having trouble right now. Try again later.";
  return `That website returned an error (HTTP ${status}). ${TRY_ELSEWHERE}`;
}
/** A connection problem described by what failed (finding the site, trusting it, or reaching it), never by guess. */
export function network_failure(error) {
  if (error instanceof WebImportError) return error;
  const code = String(error?.code || error?.cause?.code || "");
  if (["ENOTFOUND", "EAI_NONAME", "EAI_NODATA"].includes(code))
    return new WebImportError("Votic couldn't find that website. Check the address and try again.");
  if (code === "EAI_AGAIN")
    return new WebImportError("Votic couldn't look up that website right now. Check your connection and try again.");
  if (/^(?:CERT_|ERR_TLS|ERR_SSL|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO|HOSTNAME_MISMATCH)/.test(code) || code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return new WebImportError("That website's secure connection couldn't be verified, so Votic didn't download it.");
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"].includes(code))
    return new WebImportError("Votic couldn't connect to that website. Try again later.");
  return new WebImportError("The webpage could not be downloaded. Try again later.");
}
/** Bot checks and script-only shells that arrive as HTTP 200 but contain no page text. */
export function needs_javascript(response, html) {
  if (/challenge/i.test(response.headers.get("cf-mitigated") || "")) return true;
  const head = html.slice(0, 20_000);
  return /<title>\s*just a moment\.{0,3}\s*<\/title>/i.test(head) || /\/cdn-cgi\/challenge-platform\//i.test(head) ||
    /enable javascript and cookies to continue/i.test(head);
}
function readable_type_failure(type) {
  if (type.includes("application/pdf")) return "That link is a PDF file. Download it, then import it as a document.";
  return "That link does not point to a readable webpage.";
}
/** Why a non-redirect response can't be imported, judged from its status and headers, or null to read it. */
function rejected_response(response) {
  if (!response.ok) return http_failure(response);
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) return readable_type_failure(type);
  return needs_javascript(response, "") ? JAVASCRIPT_PAGE : null;
}
/** Too little article text: a script-only page says so; otherwise the page simply had no article. */
function too_little_text(html) {
  return /<noscript[^>]*>[^<]{0,300}javascript/i.test(html)
    ? JAVASCRIPT_PAGE
    : "Votic could not find enough readable article text on that webpage.";
}

export async function import_public_webpage(value, { fetchImpl = fetch_public_page, lookupImpl = lookup, timeoutMs = 15_000, signal } = {}) {
  const started = Date.now();
  const remaining = () => Math.max(1, timeoutMs - (Date.now() - started));
  // A late OS lookup cannot start a download after the shared deadline.
  const bounded_lookup = async (...args) => {
    let timer, rejectAbort;
    const canceled = () => rejectAbort?.(new WebImportError("Webpage import canceled."));
    try {
      const deadline = new Promise((_, reject) => {
        rejectAbort = reject;
        timer = setTimeout(() => reject(new WebImportError("The webpage took too long to resolve.")), remaining());
        signal?.addEventListener("abort", canceled, { once: true });
        if (signal?.aborted) canceled();
      });
      return await Promise.race([lookupImpl(...args), deadline]);
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", canceled); }
  };
  let target = await resolve_public_url(value, bounded_lookup);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    let response, reader, timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new WebImportError("The webpage took too long to download. Try again."));
      }, remaining());
    });
    const download = async () => {
      try {
        response = await fetchImpl(target.url, {
          redirect: "manual", signal: controller.signal,
          headers: { "User-Agent": WEB_IMPORT_USER_AGENT, "Accept": "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
        }, target.addresses);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        throw network_failure(error);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new WebImportError("The webpage redirected too many times.");
        return { redirect: location };
      }
      const rejection = rejected_response(response);
      if (rejection) throw new WebImportError(rejection);
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
      const html = await read_html_stream(reader);
      if (needs_javascript(response, html)) throw new WebImportError(JAVASCRIPT_PAGE);
      const cleaned = await clean_webpage_isolated(html, {
        signal: controller.signal, timeoutMs: Math.min(5000, remaining()),
      });
      if (cleaned.text.length < 80) throw new WebImportError(too_little_text(html));
      return { ...cleaned, url: target.url.toString() };
    };
    let result;
    try { result = await Promise.race([download(), timeout]); }
    finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
      else if (response?.body) void response.body.cancel().catch(() => {});
    }
    if (!result.redirect) return result;
    target = await resolve_public_url(new URL(result.redirect, target.url).toString(), bounded_lookup);
  }
  throw new WebImportError("The webpage could not be imported.");
}
