const fs = require("node:fs");
const cp = require("node:child_process");
const REQUIRED = ["automated-checks", "android-device", "ios-device", "billing-sandbox", "account-deletion",
  "backup-restore-drill", "alerts-and-native-crashes", "dependency-risk-review", "privacy-and-legal", "repository-protection"];

function validate_evidence(evidence, commit, now = Date.now()) {
  if (evidence?.version !== 1 || !Array.isArray(evidence.platforms) || !evidence.platforms.length || evidence.platforms.some(item => !["android", "ios"].includes(item)) || evidence.commit !== commit || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Release evidence must identify the exact release commit.");
  const missing = REQUIRED.filter(id => {
    if (id === "ios-device" && !evidence.platforms.includes("ios")) return false;
    if (id === "android-device" && !evidence.platforms.includes("android")) return false;
    const item = evidence.checks?.[id];
    return item?.status !== "verified" || typeof item.reviewer !== "string" || !item.reviewer.trim() ||
      typeof item.evidence !== "string" || item.evidence.trim().length < 10 ||
      !Number.isFinite(Date.parse(item.checkedAt)) || Date.parse(item.checkedAt) > now;
  });
  if (missing.length) throw new Error("Release verification is incomplete: " + missing.join(", "));
  return true;
}
module.exports = { validate_evidence, REQUIRED };
if (require.main === module) {
  if (!process.argv[2]) throw new Error("Provide a completed release evidence JSON file; the example intentionally fails.");
  const commit = cp.execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
  validate_evidence(JSON.parse(fs.readFileSync(process.argv[2], "utf8")), commit);
  console.log("Release evidence is complete for " + commit + ". Reviewer attestations still require human review.");
}
