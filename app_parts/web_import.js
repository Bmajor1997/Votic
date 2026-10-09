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
function privateIp(address) {
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
async function resolvePublicUrl(value, lookupImpl) {
  let url;
  try { url = new URL(value); } catch { throw new WebImportError("Enter a valid webpage address."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new WebImportError("Only http and https webpage links are supported.");
  if (url.username || url.password) throw new WebImportError("Webpage links cannot contain sign-in credentials.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) throw new WebImportError("That webpage address is not public.");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] :
    await lookupImpl(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => privateIp(item.address))) throw new WebImportError("That webpage address is not public.");
  return { url, addresses };
}
export async function validate_public_url(value, lookupImpl = lookup) {
  return (await resolvePublicUrl(value, lookupImpl)).url;
}

/** Keep the hostname for TLS verification/Host, but connect only to an address already validated. */
export function fetch_public_page(url, options, addresses, requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest) {
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
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
}

function decodeEntities(text) {
  return text.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
}
export function clean_webpage_html(html) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).slice(0,200);
  let source = html
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|noscript|svg|canvas|iframe|form|nav|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<(br|hr)\b[^>]*>/gi,"\n")
    .replace(/<\/(p|div|section|article|main|h[1-6]|li|blockquote)>/gi,"\n")
    .replace(/<li\b[^>]*>/gi,"• ")
    .replace(/<[^>]+>/g," ");
  source = decodeEntities(source).replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  const lines = source.split("\n").map((line)=>line.trim()).filter(Boolean).filter((line)=>line.length > 1);
  const seen = new Set(), kept = [];
  for (const line of lines) {
    const key=line.toLocaleLowerCase();
    if (seen.has(key) && line.length < 160) continue;
    seen.add(key);
    if (/^(cookie|accept all|privacy settings|sign up|subscribe|advertisement|skip to content)$/i.test(line)) continue;
    kept.push(line);
  }
  return { title, text: kept.join("\n\n").slice(0,400_000) };
}
export async function import_public_webpage(value, { fetchImpl = fetch_public_page, lookupImpl = lookup, timeoutMs = 15_000 } = {}) {
  let target = await resolvePublicUrl(value, lookupImpl);
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
    target = await resolvePublicUrl(new URL(result.redirect, target.url).toString(), lookupImpl);
  }
  throw new WebImportError("The webpage could not be imported.");
}
