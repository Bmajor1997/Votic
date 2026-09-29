/** Component and integration tests (React Native Testing Library). Pure-logic tests run in Vitest. */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
  setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.ts"],
  // Animations schedule timers; fake timers keep them from firing after a test's environment is torn down.
  fakeTimers: { enableGlobally: true },
  // Undo jest.spyOn (e.g. a failing AsyncStorage.setItem) so one test cannot leak into the next.
  restoreMocks: true,
  // The first test in a run pays for compiling React Native, which can exceed Jest's 5 s default in CI.
  testTimeout: 30000,
};
