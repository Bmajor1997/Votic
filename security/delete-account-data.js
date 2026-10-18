import { create_usage_store } from "../app_parts/ai_usage.js";
import { delete_account_data } from "../app_parts/account_deletion.js";

// Private-host operator tool for ownership-verified external requests. Never a public route.
const uid = process.argv.find((arg) => arg.startsWith("--uid="))?.slice(6);
if (!uid || !process.argv.includes("--confirmed-owner") || !process.env.VOTIC_AI_USAGE_DB || process.env.VOTIC_AI_USAGE_DB === ":memory:")
  throw new Error("Use --uid=VERIFIED_UID --confirmed-owner and a private persistent VOTIC_AI_USAGE_DB.");
const store = create_usage_store(process.env);
try {
  await delete_account_data({ uid, auth_time: Date.now() / 1000, phase: "complete", env: process.env, store });
  console.log("Backend data removed. Complete Firebase user deletion in the authenticated Firebase console, then confirm the external request.");
} finally { store.close(); }
