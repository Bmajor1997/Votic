import AsyncStorage from "@react-native-async-storage/async-storage";
import { reset_account_deletion_state } from "../src/storage/accountDeletion";
import { beforeEach, jest } from "@jest/globals";
import { fakeAuth } from "./mocks/authBackend";
import { reset_expo_router_mock } from "./mocks/expoRouter";
import { fakeScanPhotos } from "./mocks/scanDraftFiles";
import { fakeSubscriptions } from "./mocks/subscriptionService";

// Mock factories run before imports resolve, so they must use require().
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../src/documents/scanDraftFiles", () => require("./mocks/scanDraftFiles"));
jest.mock("expo-router", () => require("./mocks/expoRouter"));
jest.mock("expo-audio", () => ({
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioStream: jest.fn(() => ({
    isStreaming: false,
    stream: {
      isStreaming: false,
      start: jest.fn(async () => {}),
      stop: jest.fn(async () => {}),
    },
  })),
}));
jest.mock("../src/auth/authBackend", () => require("./mocks/authBackend"));
jest.mock("../src/subscription/subscriptionService", () => require("./mocks/subscriptionService"));
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(async () => {
  reset_account_deletion_state();
  fakeScanPhotos.clear();
  await AsyncStorage.clear();
  reset_expo_router_mock();
  fakeAuth.reset();
  fakeSubscriptions.reset();
});
