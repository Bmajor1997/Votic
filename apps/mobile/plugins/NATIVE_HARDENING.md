# Native dependency hardening

The native CodeQL gate remains strict. The Expo prebuild plugin applies small, checked changes to local dependency build copies; no SARIF findings are filtered or suppressed.

Reviewed against `@expo/log-box` 57.0.4 and RevenueCat iOS 5.94.0 (via react-native-purchases 10.12.2 / PurchasesHybridCommon 19.10.0):

- Expo LogBox unconditionally enabled process-wide WebView debugging. Prebuild sets that call to `false`, including in development builds. The LogBox UI remains available, but remote inspection of its WebView is disabled.
- RevenueCat ErrorUtils forwarded dynamic error descriptions to its logger. The local pod logs only the SDK's static error-code description. Original NSError descriptions and underlying errors still reach callers unchanged.
- RevenueCat's `validateAndLog(apiKey:)` triggered a raw-key logging-boundary finding, although its implementation logs key classification rather than the key itself. The build copy uses `validateForVotic(apiKey:)`, retaining the exact validator and removing its optional classification diagnostics. The SDK's test-store release safeguard remains intact.

Android hardening runs in the prebuild dangerous mod. iOS hardening runs inside CocoaPods `post_install`, before compilation, for both CI and ordinary Expo/EAS builds. Repeated prebuild and pod installs are supported. Changed or missing upstream source fails the build for review rather than silently skipping a patch. SDK files retain their original permissions.

Run `node --test code_checks/native_dependency_hardening.test.js` from the repository root. Full Android and iOS builds and CodeQL must verify each dependency upgrade.

Upstream sources:

- https://github.com/expo/expo/blob/sdk-57/packages/@expo/log-box/android/src/main/expo/modules/logbox/ExpoLogBoxWebViewWrapper.kt
- https://github.com/RevenueCat/purchases-ios/blob/5.94.0/Sources/Error%20Handling/ErrorUtils.swift
- https://github.com/RevenueCat/purchases-ios/blob/5.94.0/Sources/Purchasing/Configuration.swift
- https://github.com/RevenueCat/purchases-ios/blob/5.94.0/Sources/Purchasing/Purchases/Purchases.swift
