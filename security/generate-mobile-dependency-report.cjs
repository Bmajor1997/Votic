const fs = require("fs");
const cp = require("child_process");
const { blocking_mobile_findings } = require("./check-mobile-audit.cjs");

let audit = {};
try {
  audit = JSON.parse(cp.execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
} catch (error) {
  audit = JSON.parse(error.stdout || "{}");
}

const blocking = blocking_mobile_findings(audit);
const vulnerabilities = audit.vulnerabilities;
const metadata = audit.metadata?.vulnerabilities || {};
const rows = Object.entries(vulnerabilities)
  .sort((a,b) => {
    const severity = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
    return (severity[a[1].severity] ?? 5) - (severity[b[1].severity] ?? 5) || a[0].localeCompare(b[0]);
  });

function recommendation(name, v) {
  const fix = v.fixAvailable;
  if (fix === true) return "Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.";
  if (fix && typeof fix === "object") {
    const breaking = fix.isSemVerMajor ? " This is a breaking/major change, so do not apply it automatically." : "";
    return `Review upgrade to ${fix.name || name}@${fix.version || "the patched version"}.${breaking} Validate Expo compatibility and the mobile test suite before merging.`;
  }
  return "No safe automated fix is currently reported. Track the upstream package/framework and update when a compatible patched release is available.";
}

const lines = [
  "# Votic Mobile Dependency Security Report",
  "",
  "This file is generated automatically by GitHub Actions from `npm audit`.",
  "",
  `**Generated:** ${new Date().toISOString()}`,
  "",
  "## Summary",
  "",
  `- Critical: ${metadata.critical || 0}`,
  `- High: ${metadata.high || 0}`,
  `- Moderate: ${metadata.moderate || 0}`,
  `- Low: ${metadata.low || 0}`,
  "",
  "Counts include inherited/transitive package entries, not distinct demonstrated application exploits. This production-dependency scan can include Expo build tooling because Expo is a production dependency.",
  "",
  `Current mobile gate: ${blocking.length} unapproved high/critical package entries. The gate permits only its documented advisory exceptions; passing does not mean zero vulnerabilities. See check-mobile-audit.cjs and osv-scanner.toml.`,
  "",
  "Semgrep and Gitleaks remain separate checks for source code and secrets. Package-manager major upgrades or downgrades require compatibility and exposure review; they are not applied automatically.",
  "",
  "## Dependency findings",
  ""
];

if (!rows.length) lines.push("No dependency vulnerabilities reported.");
for (const [name, v] of rows) {
  const via = (v.via || []).map(x => typeof x === "string" ? x : (x.title || x.name || x.url)).filter(Boolean);
  lines.push(
    `### ${name}`,
    "",
    `- **Severity:** ${v.severity}`,
    `- **Direct dependency:** ${v.isDirect ? "Yes" : "No (transitive)"}`,
    `- **Affected range:** ${v.range || "Not reported"}`,
    `- **Introduced through / advisory:** ${via.join("; ") || "Not reported"}`,
    `- **Recommendation:** ${recommendation(name, v)}`,
    ""
  );
}

fs.mkdirSync("../../security", { recursive: true });
fs.writeFileSync("../../security/mobile-dependency-report.md", lines.join("\n").trimEnd() + "\n");
