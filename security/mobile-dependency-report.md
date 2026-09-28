# Votic Mobile Dependency Security Report

This file is generated automatically by GitHub Actions from `npm audit`.

**Generated:** 2026-09-28T13:06:20.709Z

## Summary

- Critical: 0
- High: 0
- Moderate: 13
- Low: 0

High and critical dependency findings fail CI. Low and moderate findings are tracked below. Semgrep and Gitleaks remain separate checks for Votic source code and secrets.

## Low and moderate findings

### @expo/cli

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** <=0.0.0-canary-20231123-1b19f96-4 || >=0.0.1-canary-20231125-d600e44
- **Introduced through / advisory:** @expo/config; @expo/config-plugins; @expo/inline-modules; @expo/metro-config; @expo/prebuild-config
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/config

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** <=0.0.1-canary-20240418-8d74597 || >=3.3.23-alpha.0
- **Introduced through / advisory:** @expo/config-plugins
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/config-plugins

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** xcode
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/inline-modules

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.0.2-canary-20260409-6fc2991
- **Introduced through / advisory:** @expo/config-plugins
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/local-build-cache-provider

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** @expo/config
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/metro-config

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** <=0.0.1-canary-20240418-8d74597 || >=0.1.49-alpha.0
- **Introduced through / advisory:** @expo/config
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### @expo/prebuild-config

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** *
- **Introduced through / advisory:** @expo/config; @expo/config-plugins
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### decode-uri-component

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** <=0.4.2
- **Introduced through / advisory:** decode-uri-component: Denial of service via exponential decoding of malformed percent-encoded input
- **Recommendation:** Review upgrade to expo-router@5.1.11. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### expo

- **Severity:** moderate
- **Direct dependency:** Yes
- **Affected range:** 40.0.0-alpha.0 - 40.0.0-beta.5 || >=41.0.0-alpha.0
- **Introduced through / advisory:** @expo/cli; @expo/config; @expo/config-plugins; @expo/local-build-cache-provider; @expo/metro-config
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### expo-router

- **Severity:** moderate
- **Direct dependency:** Yes
- **Affected range:** 1.2.2 - 3.1.2 || >=5.2.0-canary-20250611-f0afe80
- **Introduced through / advisory:** query-string
- **Recommendation:** Review upgrade to expo-router@5.1.11. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### query-string

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** 5.0.0 - 9.4.1
- **Introduced through / advisory:** decode-uri-component
- **Recommendation:** Review upgrade to expo-router@5.1.11. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### uuid

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** <11.1.1
- **Introduced through / advisory:** uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

### xcode

- **Severity:** moderate
- **Direct dependency:** No (transitive)
- **Affected range:** >=0.9.2
- **Introduced through / advisory:** uuid
- **Recommendation:** Review upgrade to expo@46.0.21. This is a breaking/major change, so do not apply it automatically. Validate Expo compatibility and the mobile test suite before merging.

