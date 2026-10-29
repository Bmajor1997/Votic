# deepmerge prototype-poisoning fix

The mobile lockfile previously installed upstream deepmerge 4.3.1 through Expo
config (SDK 55 and 57) and Jest. OSV blocked this version for
GHSA-gcqx-w48m-w2h4 / CVE-2026-93753. Upstream has no patched npm release as of
October 28, 2026.

`apps/mobile/vendor/deepmerge` contains an MIT-licensed local fork of the upstream
4.3.1 bundled CommonJS implementation and type declarations. The patch rejects
`__proto__`, `constructor`, and `prototype` in both copy loops, writes own data
properties with `Object.defineProperty`, and fails closed when object membership
inspection throws. Null and primitive placeholders retain normal merge behavior.
The bundled JavaScript uses const and repository formatting to pass mobile lint.

The root mobile file dependency and `$deepmerge` override direct all three
consumers to the fork, including under `npm ci --ignore-scripts`. The lockfile
contains no registry deepmerge installation. No scanner exception, severity gate,
or workflow was changed. OSV excludes local/unscannable packages, so its clean
result alone does not establish the fork's safety; the exploit regressions and
upstream compatibility tests provide that evidence. Future fixes to this fork
must be reviewed manually until it is replaced by a verified upstream release.

Validation:

- Fresh mobile `npm ci --ignore-scripts` succeeds; both Expo config versions and
  Jest resolve deepmerge to the local fork.
- 307 backend tests pass, including three new security/compatibility regressions.
- All 117 assertions in upstream deepmerge's JavaScript test suite pass against
  the patched implementation (upstream HEAD d774850765a872f0cd642b0c87fc7e841af71f4c).
- 477 mobile reliability tests and 655 component/integration tests pass, including
  the existing coverage gates.
- Mobile formatting and TypeScript checks pass. Code metrics report zero regressions.
- Expo public config and Android/iOS `prebuild --no-install` succeed in a temporary
  copy. This does not replace native compilation in GitHub Actions.
- Expo's online dependency compatibility request timed out locally; its offline
  check reports dependencies up to date, with the usual offline reliability caveat.
- OSV-Scanner 2.6.0 reports no issues. The existing two unrelated temporary
  exceptions remain unchanged. The mobile production npm audit gate passes.

Remove the fork, root file dependency, and override together when upstream ships
a verified fix, then rerun these checks.
