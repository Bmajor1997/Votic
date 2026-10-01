import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, jest } from "@jest/globals";
import { fakeAuth } from "./mocks/authBackend";
import { resetExpoRouterMock } from "./mocks/expoRouter";

// Mock factories run before imports resolve, so they must use require().
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-router", () => require("./mocks/expoRouter"));
jest.mock("../src/auth/authBackend", () => require("./mocks/authBackend"));
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(async () => {
  await AsyncStorage.clear();
  resetExpoRouterMock();
  fakeAuth.reset();
});
