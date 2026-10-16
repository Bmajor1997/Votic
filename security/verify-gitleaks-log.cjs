const fs = require("node:fs");

function verify_gitleaks_log(log) {
  const counts = [...log.matchAll(/\b(\d+) commits? scanned\b/g)].map((match) => Number(match[1]));
  if (!counts.length || counts.some((count) => count === 0) ||
      /command aborted|stderr is not empty|exit status 128/i.test(log)) {
    throw new Error("The secret scan did not successfully inspect repository history.");
  }
}
module.exports = { verify_gitleaks_log };
if (require.main === module) verify_gitleaks_log(fs.readFileSync(process.argv[2], "utf8"));
