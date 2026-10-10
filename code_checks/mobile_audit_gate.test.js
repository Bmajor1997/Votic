import test from "node:test";
import assert from "node:assert/strict";
import checker from "../security/check-mobile-audit.cjs";
const { blockingMobileFindings } = checker;
const advisory = (severity, id) => ({ severity, url: `https://github.com/advisories/${id}` });
const report = (via) => ({ vulnerabilities: { parent: { severity: "high", via } } });

test("mobile audit classifies leaf severity without expanding the existing exceptions", () => {
  assert.deepEqual(blockingMobileFindings(report([
    advisory("high", "GHSA-vfj7-8cjw-p6xm"),
    advisory("moderate", "GHSA-hp3w-g68c-fv3c"),
  ])), []);
  assert.equal(blockingMobileFindings(report([
    advisory("high", "GHSA-vfj7-8cjw-p6xm"), advisory("critical", "GHSA-new-critical"),
  ])).length, 1);
  assert.equal(blockingMobileFindings(report([advisory("high", "GHSA-new-high")])).length, 1);
});
test("mobile audit resolves indirect advisories, including cyclic dependencies", () => {
  const audit = { vulnerabilities: {
    parent: { severity: "high", via: ["child"] },
    child: { severity: "high", via: ["parent", advisory("high", "GHSA-86w9-cpqp-85rv"), advisory("moderate", "GHSA-hp3w-g68c-fv3c")] },
  } };
  assert.deepEqual(blockingMobileFindings(audit), []);
  audit.vulnerabilities.child.via.push(advisory("high", "GHSA-new-high"));
  assert.equal(blockingMobileFindings(audit).length, 2);
});
test("mobile audit fails closed for missing reports or incomplete high severity details", () => {
  for (const audit of [{}, { error: { message: "registry unavailable" }, vulnerabilities: {} }, { vulnerabilities: null }])
    assert.throws(() => blockingMobileFindings(audit), /valid vulnerability report/);
  for (const via of [[], [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }], [advisory("moderate", "GHSA-moderate")]])
    assert.equal(blockingMobileFindings(report(via)).length, 1);
});
