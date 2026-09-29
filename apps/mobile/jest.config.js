/** Component tests (React Native Testing Library). Pure-logic tests run in Vitest. */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.component.test.tsx"],
  setupFiles: ["<rootDir>/tests/jestSetup.ts"],
  // The first test in a run pays for compiling React Native, which can exceed Jest's 5 s default in CI.
  testTimeout: 30000,
};
