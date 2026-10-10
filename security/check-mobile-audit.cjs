const fs = require("node:fs");
const HIGH = new Set(["high", "critical"]);
// The existing exceptions stay scoped to their original advisories.
const ALLOWED = new Set(["GHSA-vfj7-8cjw-p6xm", "GHSA-86w9-cpqp-85rv"]);

function blockingMobileFindings(audit) {
  if (audit?.error || !audit?.vulnerabilities || typeof audit.vulnerabilities !== "object" || Array.isArray(audit.vulnerabilities))
    throw new Error("The mobile dependency audit did not produce a valid vulnerability report.");
  const vulnerabilities = audit.vulnerabilities;
  function leaves(name, seen = new Set()) {
    if (seen.has(name)) return [];
    seen.add(name);
    const finding = vulnerabilities[name];
    return (Array.isArray(finding?.via) ? finding.via : []).flatMap((via) =>
      typeof via === "string" ? leaves(via, new Set(seen)) : via && typeof via === "object" ? [via] : [],
    );
  }
  const blocking = [];
  for (const [name, finding] of Object.entries(vulnerabilities)) {
    if (!HIGH.has(finding?.severity)) continue;
    const advisories = leaves(name);
    if (!advisories.length || advisories.some((item) => !["info", "low", "moderate", "high", "critical"].includes(item.severity))) {
      blocking.push(`${name}: missing advisory severity/details`);
      continue;
    }
    const high = advisories.filter((item) => HIGH.has(item.severity));
    if (!high.length) {
      blocking.push(`${name}: no high/critical advisory details`);
      continue;
    }
    const unapproved = high.filter((item) => {
      const details = `${item.url || ""} ${item.title || ""}`.toLowerCase();
      return ![...ALLOWED].some((id) => details.includes(id.toLowerCase()));
    });
    if (unapproved.length) blocking.push(`${name}: unapproved high/critical advisory`);
  }
  return blocking;
}
module.exports = { blockingMobileFindings };
if (require.main === module) {
  const blocking = blockingMobileFindings(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
  if (blocking.length) {
    console.error("Blocking high/critical dependency vulnerabilities:");
    blocking.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
  } else console.log("No unapproved high/critical production dependency vulnerabilities.");
}
