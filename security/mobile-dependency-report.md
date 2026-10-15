# Votic Mobile Dependency Security Report

This file is generated automatically by GitHub Actions from `npm audit`.

**Generated:** 2026-10-15T20:31:07.084Z

## Summary

- Critical: 0
- High: 47
- Moderate: 5
- Low: 0

Counts include inherited/transitive package entries, not distinct demonstrated application exploits. This production-dependency scan can include Expo build tooling because Expo is a production dependency.

Current mobile gate: 0 unapproved high/critical package entries. The gate permits only its documented advisory exceptions; passing does not mean zero vulnerabilities. See check-mobile-audit.cjs and osv-scanner.toml.

Semgrep and Gitleaks remain separate checks for source code and secrets. Package-manager major upgrades or downgrades require compatibility and exposure review; they are not applied automatically.

## Dependency findings

### @bacons/apple-targets

- **Severity:** high
- **Direct dependency:** Yes
- **Affected range:** >=4.0.0
- **Introduced through / advisory:** expo
- **Recommendation:** Review upgrade to @bacons/apple-targets@3.0.7. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/cli

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=0.0.0-canary-20231123-1b19f96-4 || >=0.0.1-canary-20231125-d600e44
- **Introduced through / advisory:** @expo/code-signing-certificates; @expo/metro; @expo/metro-config; node-forge
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/code-signing-certificates

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** node-forge
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### @expo/metro

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** metro; metro-config; metro-file-map; metro-transform-worker
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/metro-config

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.21.0-canary-20250630-547cd82
- **Introduced through / advisory:** @expo/metro
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/console

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 25.4.0 - 30.2.0
- **Introduced through / advisory:** jest-message-util
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/core

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** @jest/console; @jest/reporters; @jest/test-result; @jest/transform; jest-config; jest-haste-map; jest-message-util; jest-resolve; jest-resolve-dependencies; jest-runner; jest-runtime; jest-snapshot; jest-watcher; micromatch
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/environment

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** @jest/fake-timers
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/expect

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** expect; jest-snapshot
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/fake-timers

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** jest-message-util
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/globals

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** @jest/environment; @jest/expect
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/reporters

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** @jest/console; @jest/test-result; @jest/transform; jest-message-util
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### @jest/test-result

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 25.4.0 - 30.2.0
- **Introduced through / advisory:** @jest/console
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/test-sequencer

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** <=30.2.0
- **Introduced through / advisory:** @jest/test-result; jest-haste-map
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @jest/transform

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** babel-plugin-istanbul; jest-haste-map; micromatch
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @react-native-google-signin/google-signin

- **Severity:** high
- **Direct dependency:** Yes
- **Affected range:** >=9.0.0
- **Introduced through / advisory:** expo
- **Recommendation:** Review upgrade to @react-native-google-signin/google-signin@8.2.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @react-native/community-cli-plugin

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** @react-native/metro-config; metro; metro-config
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @react-native/jest-preset

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** babel-jest; jest-environment-node
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @react-native/metro-config

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** metro-config
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @react-native/virtualized-lists

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 0.85.0-nightly-20260108-1236b6be4 - 0.87.0-rc.4
- **Introduced through / advisory:** react-native
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### babel-jest

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=24.2.0-alpha.0
- **Introduced through / advisory:** @jest/transform; babel-plugin-istanbul
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### braces

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** braces vulnerable to stack-exhaustion denial of service through deeply nested patterns
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### create-jest

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 29.7.0 - 30.2.0
- **Introduced through / advisory:** jest-config
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### expect

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 21.0.0-beta.1 - 30.2.0
- **Introduced through / advisory:** jest-message-util
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### expo

- **Severity:** high
- **Direct dependency:** Yes
- **Affected range:** >=45.0.0-beta.1
- **Introduced through / advisory:** @expo/cli; @expo/metro; @expo/metro-config
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest

- **Severity:** high
- **Direct dependency:** Yes
- **Affected range:** 24.2.0-alpha.0 - 30.2.0
- **Introduced through / advisory:** @jest/core; jest-cli
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-circus

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 20.1.0-alpha.1 - 30.2.0
- **Introduced through / advisory:** @jest/environment; @jest/expect; @jest/test-result; jest-message-util; jest-runtime; jest-snapshot
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-cli

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 23.5.0 - 30.2.0
- **Introduced through / advisory:** @jest/core; @jest/test-result; create-jest; jest-config
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-config

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 18.1.0 - 18.5.0-alpha.7da3df39 || 23.5.0 - 30.2.0
- **Introduced through / advisory:** @jest/test-sequencer; babel-jest; jest-circus; jest-environment-node; jest-resolve; jest-runner; micromatch
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-environment-node

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 24.2.0-alpha.0 - 30.2.0
- **Introduced through / advisory:** @jest/environment; @jest/fake-timers
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-haste-map

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 18.1.0 - 30.2.0
- **Introduced through / advisory:** micromatch
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-message-util

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 18.5.0-alpha.7da3df39 - 30.2.0
- **Introduced through / advisory:** micromatch
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-resolve

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 18.1.0 - 19.0.2 || 24.2.0-alpha.0 - 24.5.0 || 27.1.0 - 30.2.0
- **Introduced through / advisory:** jest-haste-map
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-resolve-dependencies

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 27.0.0-next.0 - 30.2.0
- **Introduced through / advisory:** jest-snapshot
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### jest-runner

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 21.0.0-alpha.1 - 30.2.0
- **Introduced through / advisory:** @jest/console; @jest/environment; @jest/test-result; @jest/transform; jest-environment-node; jest-haste-map; jest-message-util; jest-resolve; jest-runtime; jest-watcher
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-runtime

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 18.1.0 - 30.2.0
- **Introduced through / advisory:** @jest/environment; @jest/fake-timers; @jest/globals; @jest/test-result; @jest/transform; jest-haste-map; jest-message-util; jest-resolve; jest-snapshot
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-snapshot

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 23.3.0 - 30.2.0
- **Introduced through / advisory:** @jest/transform; expect; jest-message-util
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### jest-watcher

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 25.4.0 - 30.2.0
- **Introduced through / advisory:** @jest/test-result
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### metro

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.71.0
- **Introduced through / advisory:** metro-config; metro-file-map; metro-transform-worker
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### metro-config

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.71.0
- **Introduced through / advisory:** metro
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### metro-file-map

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** micromatch
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### metro-transform-worker

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.71.0
- **Introduced through / advisory:** metro
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### micromatch

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.2.0
- **Introduced through / advisory:** braces
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### node-forge

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements
- **Recommendation:** Review upgrade to expo@44.0.6. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### react-native

- **Severity:** high
- **Direct dependency:** Yes
- **Affected range:** >=0.73.0-nightly-20230506-1af868c52
- **Introduced through / advisory:** @react-native/community-cli-plugin; @react-native/jest-preset; @react-native/virtualized-lists
- **Recommendation:** Review upgrade to react-native@0.88.0. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### react-native-reanimated

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** 3.20.0-nightly-20250722-b6c8b9a3c - 4.0.0-nightly-20250309-9ce9085cb || 4.2.0-nightly-20250829-e8916d7ed - 4.2.0-nightly-20251017-235c127fd || 4.4.0-nightly-20260325-414e8adaf - 4.7.1
- **Introduced through / advisory:** react-native-worklets
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### react-native-worklets

- **Severity:** high
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.8.0-bundle-mode-preview-1
- **Introduced through / advisory:** @react-native/metro-config
- **Recommendation:** Run the normal package-manager update in a review branch, then rerun Expo compatibility, type-checking, tests, Semgrep, and npm audit.

### @istanbuljs/load-nyc-config

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** js-yaml
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### argparse

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** 1.0.0 - 1.0.10
- **Introduced through / advisory:** sprintf-js
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### babel-plugin-istanbul

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** >=6.0.0-beta.0
- **Introduced through / advisory:** @istanbuljs/load-nyc-config
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### js-yaml

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** 3.2.7 - 3.15.2
- **Introduced through / advisory:** argparse
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### sprintf-js

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** sprintf-js vulnerable to denial of service through unbounded precision specifiers
- **Recommendation:** Review upgrade to jest@30.5.2. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.
