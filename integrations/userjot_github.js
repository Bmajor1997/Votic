/* global AbortSignal */
import { createHash } from "node:crypto";

const REPOSITORY = "Bmajor1997/Votic";
const API = `https://api.github.com/repos/${REPOSITORY}/issues`;
const MARKER = /<!-- votic-userjot:([a-f0-9]{64}) -->/g;

function plain(value) {
  return value.replace(/@/g, "@\u200b").replace(/<!--/g, "&lt;!--");
}
/** Input is the canonical public request shape; live API mapping is verified during connection setup. */
export function feedback_issue(request) {
  if (!request || typeof request.id !== "string" || !request.id || typeof request.title !== "string" ||
      !request.title.trim() || typeof request.body !== "string") throw new Error("Invalid UserJot request.");
  const url = new URL(request.url);
  if (url.origin !== "https://votic.userjot.com" || url.username || url.password ||
      !/^\/board\/p\/[a-z0-9_-]+\/?$/i.test(url.pathname)) throw new Error("Feedback is not from Votic's public board.");
  url.search = "";
  url.hash = "";
  const id = createHash("sha256").update(`votic.userjot.com:${request.id}`).digest("hex");
  const title = `[UserJot] ${plain(request.title).replace(/[\r\n]+/g, " ").trim()}`.slice(0, 240);
  const body = `${plain(request.body).slice(0, 30000)}\n\n---\nSource: <${url.href}>\n\n<!-- votic-userjot:${id} -->`;
  return { id, title, body };
}

/** One-way mirroring: no assignees, customer emails, votes, private messages, or status updates are copied. */
export async function mirror_feedback_to_github({ requests, token, dryRun = true, fetchImpl = fetch }) {
  if (!Array.isArray(requests) || requests.length > 50) throw new Error("Feedback batches must contain at most 50 requests.");
  if (typeof token !== "string" || !token.trim()) throw new Error("A GitHub issues token is required.");
  // Validate the entire batch before making any GitHub changes.
  const issues = requests.map(feedback_issue);
  const headers = { Authorization: `Bearer ${token.trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Votic-UserJot", "Content-Type": "application/json" };
  async function request(url, options = {}) {
    try {
      const response = await fetchImpl(url, { ...options, headers, redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("GitHub API rejected the request.");
      return await response.json();
    } catch { throw new Error("GitHub issue sync could not complete. Retry after checking the connection."); }
  }
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    if (page > 20) throw new Error("Too many GitHub issues to safely verify duplicates. No new issues were created.");
    const existing = await request(`${API}?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(existing)) throw new Error("GitHub returned an unexpected issue list.");
    for (const issue of existing) {
      if (issue.pull_request || typeof issue.body !== "string") continue;
      for (const match of issue.body.matchAll(MARKER)) seen.add(match[1]);
    }
    if (existing.length < 100) break;
  }
  let created = 0, skipped = 0, planned = 0;
  for (const issue of issues) {
    if (seen.has(issue.id)) { skipped += 1; continue; }
    seen.add(issue.id);
    if (dryRun) { planned += 1; continue; }
    // Never blindly retry a POST: if its response is lost, the next run finds the marker first.
    await request(API, { method: "POST", body: JSON.stringify({ title: issue.title, body: issue.body }) });
    created += 1;
  }
  return { repository: REPOSITORY, dryRun, created, skipped, planned };
}
