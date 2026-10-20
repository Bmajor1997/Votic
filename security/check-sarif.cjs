const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
if (!directory) throw new Error("Provide the native SARIF output directory.");
const files = fs.readdirSync(directory).filter(file => file.endsWith(".sarif"));
if (!files.length) throw new Error("Native analysis produced no SARIF evidence.");
let findings = 0;
for (const file of files) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  if (report.version !== "2.1.0" || !report.runs?.length) throw new Error("Invalid native SARIF evidence.");
  for (const run of report.runs) {
    if (!run.tool?.driver?.name || !Array.isArray(run.results)) throw new Error("Incomplete native SARIF evidence.");
    if (run.invocations?.some(item => item.executionSuccessful === false)) throw new Error("Native analysis did not complete.");
    for (const result of run.results || []) {
      if (result.suppressions?.some(item => item.status === "accepted")) continue;
      findings++;
      console.error(`${file}: ${result.ruleId || "unknown rule"}: ${result.message?.text || "Native finding"}`);
    }
  }
}
if (findings) process.exitCode = 1;
else console.log("Native analysis completed with no unsuppressed findings.");
