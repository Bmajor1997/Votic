/** Only public web links can be offered as originals. Cache paths are never originals. */
export function safe_source_url(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (
      !host.includes(".") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host.includes(":") ||
      /^\d+(?:\.\d+){3}$/.test(host)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
