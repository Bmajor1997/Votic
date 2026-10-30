import { configDefaults, defineConfig } from "vitest/config";

// Component tests need React Native and run in Jest (see jest.config.js).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/logic",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/documents/documentStorage.ts",
        "src/storage/storageUsage.ts",
        "src/storage/storageUsageFiles.ts",
        "src/documents/throttledSaver.ts",
        "src/subscription/entitlement.ts",
        "src/subscription/storeDeadline.ts",
        "src/api/apiConfig.ts",
        "src/documents/fileTypes.ts",
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
