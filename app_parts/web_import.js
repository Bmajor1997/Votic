import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 2_000_000;
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);
function privateIp(address) {
  if (!isIP(address)) return true;
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("10.") || address.startsWith("127.") || address.startsWith("169.254.") || address.startsWith("192.168.")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  const lower = address.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
}
export async function validate_public_url(value, lookupImpl = lookup) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Enter a valid webpage address."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https webpage links are supported.");
  if (url.username || url.password) throw new Error("Webpage links cannot contain sign-in credentials.");
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase()) || url.hostname.endsWith(".local")) throw new Error("That webpage address is not public.");
  const resolved = await lookupImpl(url.hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((item) => privateIp(item.address))) throw new Error("That webpage address is not public.");
  return url;
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
export async function import_public_webpage(value, { fetchImpl = fetch, lookupImpl = lookup, timeoutMs = 15_000 } = {}) {
  let url = await validate_public_url(value, lookupImpl);
  for (let redirects=0; redirects<=3; redirects+=1) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
    let response;
    try { response=await fetchImpl(url,{redirect:"manual",signal:controller.signal,headers:{"User-Agent":"Votic/1.0 webpage importer","Accept":"text/html,application/xhtml+xml"}}); }
    finally { clearTimeout(timer); }
    if ([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get("location");
      if (!location || redirects===3) throw new Error("The webpage redirected too many times.");
      url=await validate_public_url(new URL(location,url).toString(),lookupImpl); continue;
    }
    if (!response.ok) throw new Error("The webpage could not be downloaded.");
    const type=(response.headers.get("content-type")||"").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("That link does not point to a readable webpage.");
    const declared=Number(response.headers.get("content-length")||0);
    if (declared > MAX_HTML_BYTES) throw new Error("That webpage is too large to import.");
    const html=await response.text();
    if (Buffer.byteLength(html,"utf8") > MAX_HTML_BYTES) throw new Error("That webpage is too large to import.");
    const cleaned=clean_webpage_html(html);
    if (cleaned.text.length < 80) throw new Error("Votic could not find enough readable article text on that webpage.");
    return { ...cleaned, url: url.toString() };
  }
  throw new Error("The webpage could not be imported.");
}
