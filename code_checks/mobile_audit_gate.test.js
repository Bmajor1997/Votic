import test from "node:test";
import assert from "node:assert/strict";
import checker from "../security/check-mobile-audit.cjs";
const { blocking_mobile_findings } = checker;
const advisory = (severity, id) => ({ severity, url: `https://github.com/advisories/${id}` });
const report = (via) => ({ vulnerabilities: { parent: { severity: "high", via } } });

test("mobile audit classifies leaf severity without expanding the existing exceptions", () => {
  assert.deepEqual(blocking_mobile_findings(report([
    advisory("high", "GHSA-vfj7-8cjw-p6xm"),
    advisory("moderate", "GHSA-hp3w-g68c-fv3c"),
  ])), []);
  assert.equal(blocking_mobile_findings(report([
    advisory("high", "GHSA-vfj7-8cjw-p6xm"), advisory("critical", "GHSA-new-critical"),
  ])).length, 1);
  assert.equal(blocking_mobile_findings(report([advisory("high", "GHSA-new-high")])).length, 1);
});
test("mobile audit resolves indirect advisories, including cyclic dependencies", () => {
  const audit = { vulnerabilities: {
    parent: { severity: "high", via: ["child"] },
    child: { severity: "high", via: ["parent", advisory("high", "GHSA-vfj7-8cjw-p6xm"), advisory("moderate", "GHSA-hp3w-g68c-fv3c")] },
  } };
  assert.deepEqual(blocking_mobile_findings(audit), []);
  audit.vulnerabilities.child.via.push(advisory("high", "GHSA-new-high"));
  assert.equal(blocking_mobile_findings(audit).length, 2);
});
test("mobile audit fails closed for missing reports or incomplete high severity details", () => {
  for (const audit of [{}, { error: { message: "registry unavailable" }, vulnerabilities: {} }, { vulnerabilities: null }])
    assert.throws(() => blocking_mobile_findings(audit), /valid vulnerability report/);
  for (const via of [[], [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }], [advisory("moderate", "GHSA-moderate")]])
    assert.equal(blocking_mobile_findings(report(via)).length, 1);
});

test("the patched node-forge advisory is no longer exempted", () => {
  assert.equal(blocking_mobile_findings(report([advisory("high", "GHSA-86w9-cpqp-85rv")])).length, 1);
});
