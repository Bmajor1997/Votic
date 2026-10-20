import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import hardening from "../apps/mobile/plugins/nativeDependencyHardening.cjs";

test("Expo LogBox cannot enable WebView debugging after prebuild", () => {
  const root = mkdtempSync(join(tmpdir(), "votic-native-"));
  const file = join(root, "node_modules/@expo/log-box/android/src/main/expo/modules/logbox/ExpoLogBoxWebViewWrapper.kt");
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "WebView(context).apply {\n    setWebContentsDebuggingEnabled(true)\n}\n");
    hardening.hardenAndroid(root);
    const first = readFileSync(file, "utf8");
    assert.match(first, /setWebContentsDebuggingEnabled\(false\)/);
    assert.doesNotMatch(first, /setWebContentsDebuggingEnabled\(true\)/);
    hardening.hardenAndroid(root);
    assert.equal(readFileSync(file, "utf8"), first);
    writeFileSync(file, "upstream changed");
    assert.throws(() => hardening.hardenAndroid(root), /needs review/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("RevenueCat retains error payloads and key validation while limiting diagnostic output", () => {
  const root = mkdtempSync(join(tmpdir(), "votic-native-"));
  const base = join(root, "ios/Pods/RevenueCat/Sources");
  const originals = {
    "Error Handling/ErrorUtils.swift": `userInfo[NSLocalizedDescriptionKey as NSError.UserInfoKey] = localizedDescription
        Self.logErrorIfNeeded(
            code,
            localizedDescription: localizedDescription,
            fileName: fileName, functionName: functionName, line: line
        )
        return .init(error: code, userInfo: userInfo)`,
    "Purchasing/Configuration.swift": `    static func validateAndLog(apiKey: String) -> APIKeyValidationResult {
        let validationResult = self.validate(apiKey: apiKey)
        validationResult.logIfNeeded()
        return validationResult
    }`,
    "Purchasing/Purchases/Purchases.swift": `let apiKeyValidationResult = Configuration.validateAndLog(apiKey: apiKey)
        apiKeyValidationResult.checkForSimulatedStoreAPIKeyInRelease(systemInfo: systemInfo, apiKey: apiKey)`,
  };
  const read = (file) => readFileSync(join(base, file), "utf8");
  try {
    for (const [file, source] of Object.entries(originals)) {
      mkdirSync(dirname(join(base, file)), { recursive: true });
      writeFileSync(join(base, file), source);
      chmodSync(join(base, file), 0o444);
    }
    // Reject changed SDK code before writing any other source file.
    chmodSync(join(base, "Purchasing/Purchases/Purchases.swift"), 0o644);
    writeFileSync(join(base, "Purchasing/Purchases/Purchases.swift"), "upstream changed");
    assert.throws(() => hardening.hardenIos(root), /needs review/);
    assert.equal(read("Error Handling/ErrorUtils.swift"), originals["Error Handling/ErrorUtils.swift"]);
    writeFileSync(join(base, "Purchasing/Purchases/Purchases.swift"), originals["Purchasing/Purchases/Purchases.swift"]);
    chmodSync(join(base, "Purchasing/Purchases/Purchases.swift"), 0o444);
    hardening.hardenIos(root);
    assert.match(read("Error Handling/ErrorUtils.swift"), /localizedDescription: code.description,/);
    assert.match(read("Error Handling/ErrorUtils.swift"), /userInfo\[NSLocalizedDescriptionKey as NSError.UserInfoKey\] = localizedDescription/);
    assert.match(read("Purchasing/Configuration.swift"), /return self.validate\(apiKey: apiKey\)/);
    assert.doesNotMatch(read("Purchasing/Configuration.swift"), /logIfNeeded/);
    assert.match(read("Purchasing/Purchases/Purchases.swift"), /checkForSimulatedStoreAPIKeyInRelease/);
    const first = Object.keys(originals).map(read);
    hardening.hardenIos(root);
    assert.deepEqual(Object.keys(originals).map(read), first);
    for (const file of Object.keys(originals)) assert.equal(statSync(join(base, file)).mode & 0o777, 0o444);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("CocoaPods hardening runs after installation, once, and stops on failure", () => {
  const source = "target 'Votic' do\n  post_install do |installer|\n    react_native_post_install(installer)\n  end\nend\n";
  const result = hardening.hardenPodfile(source);
  assert.match(result, /nativeDependencyHardening.cjs/);
  assert.match(result, /\|\| raise\('Votic native hardening failed'\)/);
  assert.equal(hardening.hardenPodfile(result), result);
  assert.throws(() => hardening.hardenPodfile("changed template"), /needs review/);
  assert.throws(() => hardening.hardenPodfile(source + source), /needs review/);
});
