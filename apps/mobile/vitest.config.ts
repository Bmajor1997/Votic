import { configDefaults, defineConfig } from "vitest/config";

// Component tests need React Native and run in Jest (see jest.config.js).
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "tests/**"] } });
