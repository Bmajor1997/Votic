import test from "node:test";
import assert from "node:assert/strict";
import { inspectUserJot, USERJOT_MCP_URL } from "../integrations/userjot.js";

function fake(pages) {
  const calls = [];
  const client = {
    async connect(transport) { calls.push(["connect", transport]); },
    async listTools(params) { calls.push(["listTools", params]); return pages.shift(); },
    async close() { calls.push(["close"]); },
  };
  return { calls, makeClient: () => client, makeTransport: (url, options) => ({ url, options }) };
}

test("UserJot discovery lists request schemas without reading requests or logging tokens", async () => {
  const api = fake([
    { tools: [{ name: "deleteRequest", inputSchema: { type: "object" } }], nextCursor: "next" },
    { tools: [{ name: "listRequests", inputSchema: { type: "object", properties: { boardId: { type: "string" } }, required: ["boardId"] } }] },
  ]);
  const result = await inspectUserJot({ token: "private-token", ...api });
  assert.deepEqual(result.requestTools.map((tool) => tool.name), ["listRequests"]);
  assert.deepEqual(result.requestTools[0].inputSchema.required, ["boardId"]);
  assert.ok(!JSON.stringify(result).includes("private-token"));
  assert.equal(api.calls[0][1].url.href, USERJOT_MCP_URL);
  assert.equal(api.calls[0][1].options.requestInit.headers.Authorization, "Bearer private-token");
  assert.equal(api.calls[0][1].options.requestInit.redirect, "error");
  assert.deepEqual(api.calls[2], ["listTools", { cursor: "next" }]);
  assert.deepEqual(api.calls.at(-1), ["close"]);
  assert.throws(() => api.calls[0][1].options.fetch("https://other.example/token", {}), /Unexpected/);
});

test("UserJot discovery refuses a missing credential before opening a connection", async () => {
  const api = fake([]);
  await assert.rejects(inspectUserJot({ token: "", ...api }), /required/);
  assert.equal(api.calls.length, 0);
});

test("UserJot discovery closes its connection when pagination loops", async () => {
  const api = fake([{ tools: [], nextCursor: "same" }, { tools: [], nextCursor: "same" }]);
  await assert.rejects(inspectUserJot({ token: "private-token", ...api }), /repeated/);
  assert.deepEqual(api.calls.at(-1), ["close"]);
});

const { feedbackIssue, mirrorFeedbackToGitHub } = await import("../integrations/userjot_github.js");
const feedback = { id: "req-1", title: "Please improve reading", body: "A public feature request.", url: "https://votic.userjot.com/board/p/improve-reading" };

test("feedback mirroring validates Votic's public source and does not copy user identity fields", () => {
  const issue = feedbackIssue({ ...feedback, authorEmail: "private@example.test", title: "Hello @reader", body: "<!-- forged-marker --> @reader" });
  assert.ok(!issue.body.includes("private@example.test"));
  assert.ok(!issue.title.includes("@reader"));
  assert.ok(!issue.body.includes("<!-- forged-marker"));
  assert.throws(() => feedbackIssue({ ...feedback, url: "https://other.userjot.com/board/p/example" }), /not from/);
  assert.throws(() => feedbackIssue({ ...feedback, url: "https://votic.userjot.com/private/message" }), /not from/);
});

test("feedback mirroring defaults to a dry run and deduplicates repeated requests", async () => {
  const calls = [];
  const result = await mirrorFeedbackToGitHub({ requests: [feedback, feedback], token: "secret", fetchImpl: async (url, options) => { calls.push([url, options]); return { ok: true, json: async () => [] }; } });
  assert.deepEqual(result, { repository: "Bmajor1997/Votic", dryRun: true, created: 0, skipped: 1, planned: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].redirect, "error");
});

test("feedback mirroring skips existing closed issues and creates only missing issues", async () => {
  const calls = [];
  const old = feedbackIssue(feedback);
  const result = await mirrorFeedbackToGitHub({ requests: [feedback, { ...feedback, id: "req-2" }], token: "secret", dryRun: false, fetchImpl: async (url, options) => {
    calls.push([url, options]);
    return { ok: true, json: async () => options.method === "POST" ? { number: 2 } : [{ state: "closed", body: old.body }] };
  } });
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
  assert.equal(calls.filter(([, options]) => options.method === "POST").length, 1);
  const created = JSON.parse(calls[1][1].body);
  assert.deepEqual(Object.keys(created).sort(), ["body", "title"]);
  assert.match(created.body, /Source: <https:\/\/votic.userjot.com/);
});

test("feedback mirroring rejects a mixed-workspace batch before creating issues", async () => {
  let calls = 0;
  await assert.rejects(mirrorFeedbackToGitHub({ requests: [feedback, { ...feedback, url: "https://other.userjot.com/board/p/other" }], token: "secret", dryRun: false, fetchImpl: async () => { calls += 1; } }), /not from/);
  assert.equal(calls, 0);
});
