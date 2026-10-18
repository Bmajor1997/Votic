import { create_usage_store } from "../app_parts/ai_usage.js";
if (!process.env.VOTIC_AI_USAGE_DB || process.env.VOTIC_AI_USAGE_DB===":memory:") throw new Error("Set the private persistent ledger path.");
const store=create_usage_store(process.env);
try {
  const status=store.operationalStatus();
  const alerts=[];
  if(status.diagnostics.some(event=>event.count>0))alerts.push("Opted-in clients reported screen failures in the last two calendar days.");
  if(status.reports.open>=100)alerts.push("Answer report backlog is at least 100.");
  if(status.reports.oldest_open && Date.now()-Date.parse(status.reports.oldest_open)>7*86400000)alerts.push("An answer report has been open more than seven days.");
  if(status.reports.total>=status.reports.capacity*0.8 || status.reports.bytes>=status.reports.byte_capacity*0.8)alerts.push("Answer report storage is at least 80% full.");
  if(status.ai.reserved_usd>=status.ai.monthly_budget_usd*0.8)alerts.push("AI monthly budget is at least 80% reserved/spent.");
  if(status.database_bytes>=500_000_000)alerts.push("Private ledger has reached 500 MB; review disk capacity and retention.");
  console.log(JSON.stringify({status,alerts}));
  if(alerts.length)process.exitCode=1;
} finally {store.close();}
