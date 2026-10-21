/** Component and integration tests (React Native Testing Library). Pure-logic tests run in Vitest. */
module.exports = {
  preset: "jest-expo",
  collectCoverageFrom: [
    "src/activity/ActivityProvider.tsx",
    "src/storage/accountDeletion.ts",
    "src/storage/libraryBackup.ts",
  ],
  coverageDirectory: "coverage/components",
  coverageReporters: ["text", "json-summary", "lcov"],
  coverageThreshold: { global: { lines: 80, statements: 80, functions: 80, branches: 70 } },
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
  // jest-expo's list, plus the ES-module-only packages expo-router's real (unmocked) router needs, so navigation
  // tests can follow actual history instead of a mocked router.
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|query-string|decode-uri-component|split-on-first|filter-obj))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.ts"],
  // Animations schedule timers; fake timers keep them from firing after a test's environment is torn down.
  fakeTimers: { enableGlobally: true },
  // Undo jest.spyOn (e.g. a failing AsyncStorage.setItem) so one test cannot leak into the next.
  restoreMocks: true,
  // The first test in a run pays for compiling React Native, which can exceed Jest's 5 s default in CI.
  testTimeout: 30000,
};
