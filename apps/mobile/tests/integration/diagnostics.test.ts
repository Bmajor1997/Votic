import { beforeEach, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  set_diagnostic_owner,
  set_diagnostic_consent,
  record_screen_failure,
  flush_diagnostics,
} from "../../src/storage/diagnostics";
import { send_client_diagnostic } from "../../src/api/voticApi";
jest.mock("../../src/api/voticApi", () => ({ send_client_diagnostic: jest.fn(async () => {}) }));
beforeEach(() => {
  jest.mocked(send_client_diagnostic).mockClear();
});
it("sends no diagnostics without opt-in and only sends a bounded count after consent", async () => {
  set_diagnostic_owner("a");
  await record_screen_failure();
  await flush_diagnostics("a");
  expect(send_client_diagnostic).not.toHaveBeenCalled();
  await set_diagnostic_consent("a", true);
  await record_screen_failure();
  await record_screen_failure();
  set_diagnostic_owner("b");
  await flush_diagnostics("b");
  expect(send_client_diagnostic).not.toHaveBeenCalled();
  set_diagnostic_owner("a");
  await flush_diagnostics("a");
  expect(send_client_diagnostic).toHaveBeenCalledWith(2);
  expect(JSON.stringify(jest.mocked(send_client_diagnostic).mock.calls)).toBe("[[2]]");
});
it("disabling diagnostics removes pending counters and retains other account data", async () => {
  set_diagnostic_owner("a");
  await set_diagnostic_consent("a", true);
  await record_screen_failure();
  await AsyncStorage.setItem("unrelated", "keep");
  await set_diagnostic_consent("a", false);
  await flush_diagnostics("a");
  expect(send_client_diagnostic).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem("unrelated")).toBe("keep");
});
