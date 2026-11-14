const fs = require("node:fs");
const path = require("node:path");

// Fail closed when an SDK upgrade changes the reviewed source. Repeated prebuild/pod install is safe.
function replace_once(source, before, after, label) {
  if (source.split(after).length === 2 && !source.replace(after, "").includes(before)) return source;
  if (source.split(before).length !== 2) {
    throw new Error(`Native hardening needs review: ${label}`);
  }
  return source.replace(before, after);
}

function harden_files(root, patches) {
  // Validate every input before writing any file.
  const updates = patches.map(([relative, before, after]) => {
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, "utf8");
    return { file, source, hardened: replace_once(source, before, after, relative) };
  });
  for (const { file, source, hardened } of updates) {
    if (source === hardened) continue;
    // CocoaPods marks downloaded sources read-only. Change only this local build copy.
    const mode = fs.statSync(file).mode;
    try {
      fs.chmodSync(file, mode | 0o200);
      fs.writeFileSync(file, hardened);
    } finally {
      fs.chmodSync(file, mode);
    }
  }
}

function harden_android(projectRoot) {
  harden_files(projectRoot, [
    [
      "node_modules/@expo/log-box/android/src/main/expo/modules/logbox/ExpoLogBoxWebViewWrapper.kt",
      "    setWebContentsDebuggingEnabled(true)",
      "    setWebContentsDebuggingEnabled(false)",
    ],
  ]);
}

function harden_ios(projectRoot) {
  harden_files(path.join(projectRoot, "ios/Pods/RevenueCat/Sources"), [
    [
      "Error Handling/ErrorUtils.swift",
      "            localizedDescription: localizedDescription,\n            fileName: fileName, functionName: functionName, line: line",
      "            localizedDescription: code.description,\n            fileName: fileName, functionName: functionName, line: line",
    ],
    [
      "Purchasing/Configuration.swift",
      "    static func validateAndLog(apiKey: String) -> APIKeyValidationResult {\n        let validationResult = self.validate(apiKey: apiKey)\n        validationResult.logIfNeeded()\n        return validationResult\n    }",
      "    static func validateForVotic(apiKey: String) -> APIKeyValidationResult {\n        // Validate without passing the raw key across a logging boundary.\n        return self.validate(apiKey: apiKey)\n    }",
    ],
    [
      "Purchasing/Purchases/Purchases.swift",
      "Configuration.validateAndLog(apiKey: apiKey)",
      "Configuration.validateForVotic(apiKey: apiKey)",
    ],
  ]);
}

function harden_podfile(source) {
  const hook = "  post_install do |installer|";
  const hardened = `${hook}\n    # Votic: redact dependency diagnostics before native compilation and analysis.\n    system('node', File.join(__dir__, '../plugins/nativeDependencyHardening.cjs'), 'ios', File.expand_path('..', __dir__)) || raise('Votic native hardening failed')`;
  return replace_once(source, hook, hardened, "Podfile post_install hook");
}

module.exports = { harden_android, harden_ios, harden_podfile, replace_once };

if (require.main === module) {
  const [, , platform, root] = process.argv;
  if (!root || platform !== "ios") throw new Error("Usage: nativeDependencyHardening.cjs ios <mobile-root>");
  harden_ios(root);
}
