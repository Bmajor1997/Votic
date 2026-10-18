import { create_usage_store } from "../app_parts/ai_usage.js";

// Run only on the private backend host. No reports are exposed through a public read API.
if (!process.env.VOTIC_AI_USAGE_DB || process.env.VOTIC_AI_USAGE_DB === ":memory:") throw new Error("Set VOTIC_AI_USAGE_DB to the private production ledger.");
const store = create_usage_store(process.env);
try {
  const resolve = process.argv.find((arg) => arg.startsWith("--resolve="));
  if (resolve) store.resolveReport(resolve.slice("--resolve=".length));
  const content = process.argv.includes("--include-content");
  for (const { answer, ...metadata } of store.reports()) console.log(JSON.stringify(content ? { ...metadata, answer } : metadata));
} finally { store.close(); }
