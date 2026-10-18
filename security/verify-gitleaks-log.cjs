const fs = require("node:fs");
const { stripVTControlCharacters } = require("node:util");

function verify_gitleaks_log(log) {
  const plain = stripVTControlCharacters(log);
  const counts = [...plain.matchAll(/\b(\d+) commits? scanned\b/g)].map((match) => Number(match[1]));
  if (!counts.length || counts.some((count) => count === 0) ||
      /command aborted|stderr is not empty|exit status 128|fatal:|\bERR\b/i.test(plain) ||
      !/\bno leaks found\b/i.test(plain)) {
    throw new Error("The secret scan did not successfully inspect repository history.");
  }
}
module.exports = { verify_gitleaks_log };
if (require.main === module) verify_gitleaks_log(fs.readFileSync(process.argv[2], "utf8"));
