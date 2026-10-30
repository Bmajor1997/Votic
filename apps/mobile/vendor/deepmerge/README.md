# Votic's patched deepmerge

This private, vendored fork is based on the bundled CommonJS build and TypeScript
declarations of upstream `deepmerge` 4.3.1 (MIT). The upstream npm tarball has
SHA-1 `44b5f2147cd3b00d4b56137685966f26fd25dd4a`.

It fixes CVE-2026-93753 / GHSA-gcqx-w48m-w2h4, for which upstream has no patched
release as of October 28, 2026. Both target and source copies reject `__proto__`,
`constructor`, and `prototype` before reading or writing those properties. Writes
use `Object.defineProperty`, and throwing membership checks fail closed.

The mobile root dependency plus `$deepmerge` override makes Expo's two config
versions and Jest use this local package, including installations with
`npm ci --ignore-scripts`. No postinstall patch or vulnerability exception is used.
The private package name/version identifies this as a Votic fork, not an upstream
release. Preserve the bundled MIT license.

Regression tests live in `code_checks/deepmerge_security.test.js`. Replace this
fork and remove the override when a verified upstream fix is available, after
running the poisoning regressions, mobile tests, and Expo config/prebuild checks.

References:

- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
- https://github.com/TehShrike/deepmerge/issues/273
