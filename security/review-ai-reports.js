import { create_usage_store } from "../app_parts/ai_usage.js";

// Run only on the private backend host. No reports are exposed through a public read API.
if (!process.env.VOTIC_AI_USAGE_DB || process.env.VOTIC_AI_USAGE_DB === ":memory:") throw new Error("Set VOTIC_AI_USAGE_DB to the private production ledger.");
const store = create_usage_store(process.env);
try {
  const resolve = process.argv.find((arg) => arg.startsWith("--resolve="));
  if (resolve) store.resolveReport(resolve.slice("--resolve=".length));
  const content = process.argv.includes("--include-content");
  const cursor = process.argv.find(arg=>arg.startsWith("--after="))?.slice(8);
  const status = process.argv.find(arg=>arg.startsWith("--status="))?.slice(9) || "open";
  const after = cursor ? JSON.parse(Buffer.from(cursor,"base64url").toString("utf8")) : null;
  const page = store.reports({after,status});
  for (const { answer, ...metadata } of page) console.log(JSON.stringify(content ? { ...metadata, answer } : metadata));
  const last = page.at(-1);
  console.log(JSON.stringify({summary:store.operationalStatus().reports,next_cursor:page.length===100 ? Buffer.from(JSON.stringify({created_at:last.created_at,id:last.id})).toString("base64url") : null}));
} finally { store.close(); }
