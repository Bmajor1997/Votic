# CI dependency fixes — October 24, 2026

The failed security workflow for `f316183` stopped at the mobile production dependency audit and the repository-wide OSV scan. Both found [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in Zod. OSV also found four advisories in `fast-uri` 3.1.8 in the older Remotion lockfile.

## Changes

- Pin a project-local Zod override to **4.6.6** in mobile and both Remotion projects. This removes the vulnerable 3.25.76 and 4.5.4 installations. The override is retained in each manifest so a clean install reproduces the patched graph.
- Align every Remotion package in both video projects to **4.0.538**, the current stable patch when checked. Keep all rendering dependencies outside the mobile runtime.
- Update the older Remotion project's `fast-uri` to **3.1.9** through its lockfile.
- Increase the Android native workflow's bounded job timeout from 45 to **60 minutes**. GitHub's annotation explicitly reported that the previous job exceeded 45 minutes. Its available logs showed successful Gradle builds, emulator launch and artifact upload; this change preserves every build, test, analysis and smoke step.

The dependency gates, their severity thresholds, and `osv-scanner.toml` were not weakened. No exception was added or extended. Mobile still has the existing, narrowly scoped node-forge exception, which expires under the existing policy on November 15, 2026. This work does not claim node-forge is patched.

## Compatibility and verification

Expo SDK 57 still requests Zod 3.25.76, and there is no patched 3.x release listed for the advisory. Its installed CLI uses Zod in the dev-tool plugin and MCP command schema modules. New mobile reliability tests load those exact installed modules and verify valid/invalid plugin configuration, command enum selection, typed parameters, unknown-property rejection and command output. A regression test also proves that the patched Zod rejects an oversized constrained array before processing individual elements, matching the upstream resource-exhaustion fix. ESLint exercises its own Zod v4 consumer.

Remotion's `versions` diagnostic recommends Zod 4.5.4 and reports the deliberate 4.6.6 security override as an extra-package mismatch. The diagnostic was not patched, suppressed, or claimed to pass. Votic's compositions do not import Zod schemas or `@remotion/zod-types`; both actual composition bundles are checked with the override. Upstream recommendation alignment remains a follow-up when a compatible patched recommendation is released.

Local verification passed: **254 backend tests, 443 mobile reliability tests, and 560 mobile component/integration tests** (1,257 total), mobile type checking/lint/formatting, the mobile audit policy gate, both clean Remotion npm audits, both production bundles, Expo public configuration and production web export, and the unchanged complexity gate.

Validation uses clean `npm ci --ignore-scripts` installs in all three projects, the existing mobile audit gate, npm audits in both Remotion projects, mobile TypeScript/lint/formatting and full reliability/component tests, backend tests, Expo public configuration/export, both Remotion production bundles, and the unchanged complexity baseline. GitHub's repository-wide OSV scan is the authoritative external recheck; local standalone OSV execution was unavailable in this environment.

Sources:

- [Zod advisory and fixed version](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Upstream constrained-collection fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)
- [Failed security run](https://github.com/Bmajor1997/Votic/actions/runs/40111429064)
- [Android run with timeout annotation](https://github.com/Bmajor1997/Votic/actions/runs/40111429057)
