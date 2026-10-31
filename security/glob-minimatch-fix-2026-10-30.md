# Glob and minimatch security update

The Code Quality & Security workflow for commit `3b50733` failed its repository-wide OSV scan with six
dependency findings from two advisories:

- [GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4):
  affected glob walkers continue filesystem traversal after cancellation. Patched upstream versions
  start at 14.0.2.
- [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249):
  pattern preprocessing can amplify work. The reported patched release is 11.0.1.

## Changes

- Mobile glob dependencies in the affected >=9 range now resolve to 14.0.3. Its required path-scurry
  update to 3.0.0 is included. Jest's glob 7 remains, outside that advisory's affected range.
- Mobile minimatch consumers resolve through a private compatibility adapter backed by the separately
  installed registry package minimatch 11.0.3. The older callable and compiled-segment interfaces used
  by ESLint/Jest are adapted without retaining older matching code or regenerating regexes.
- Motion Studio's minimatch dependency resolves directly to 11.0.3.
- Both lockfiles were regenerated and verified with clean `npm ci --ignore-scripts` installs. No
  unrelated package versions were updated. The two existing OSV exceptions are unchanged; no scanner,
  severity threshold, or security check was disabled.

## Validation

- OSV-Scanner 2.6.0 (release checksum verified) scans all repository lockfiles and reports no issues.
  OSV correctly excludes the local adapter and deepmerge wrapper; the patched upstream matcher is
  scanned separately. The adapter's compatibility tests supply evidence beyond the scan result.
- All mobile logic and component/integration tests pass with the existing coverage thresholds.
- Mobile production npm audit reports zero findings; the existing audit policy gate passes.
- Motion Studio clean install, ESLint/TypeScript, production bundle and npm audit pass. Its pre-existing
  Zod/Remotion version warning remains because Zod's existing security override was retained.
- Android prebuild and generated-resource verification pass, and the Expo web production export succeeds.
- Native Android/iOS compilation and the external security checks are rechecked in GitHub Actions.

See `apps/mobile/vendor/minimatch-compat/README.md` for adapter scope and removal conditions.
