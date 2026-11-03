import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as StoreReview from "expo-store-review";
import { Linking, Platform, Pressable, Text } from "react-native";
import { ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { FeedbackScreen } from "../../src/feedback/FeedbackScreens";
import { STORE_REVIEW_KEY } from "../../src/review/storeReview";
import { REVIEW_DELAY_MS, useStoreReviewPrompt } from "../../src/review/useStoreReviewPrompt";
import { account_storage_key } from "../../src/storage/accountStorage";
import { render_with_providers } from "../renderWithProviders";

const UID = "test-user";
const platform = Platform.OS;
beforeEach(() => {
  jest.mocked(StoreReview.requestReview).mockClear();
});
afterEach(() => {
  Object.assign(Platform, { OS: platform });
});
const minute = (day: string) => ({ [`${day}T10`]: { "doc-1": { reading: 61_000, listening: 0 } } });

async function seed_active_days(days: string[]) {
  const buckets = Object.assign({}, ...days.map(minute));
  await AsyncStorage.setItem(
    account_storage_key(ACTIVITY_KEY, UID),
    JSON.stringify({ version: 1, trackingStartedAt: 0, buckets, ask: [] }),
  );
}

function CloseReader() {
  const afterReading = useStoreReviewPrompt();
  return (
    <Pressable accessibilityRole="button" onPress={afterReading}>
      <Text>Close reader</Text>
    </Pressable>
  );
}

async function close_reader() {
  await fireEvent.press(screen.getByRole("button", { name: "Close reader" }));
  for (let i = 0; i < 5; i += 1) await act(async () => {});
  await act(async () => jest.advanceTimersByTime(REVIEW_DELAY_MS + 50));
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

it("asks the store for its review card after a document is closed, once Votic is used on 3 days", async () => {
  await seed_active_days(["2026-10-30", "2026-10-31", "2026-11-01"]);
  await render_with_providers(<CloseReader />);
  await close_reader();
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  const saved = JSON.parse((await AsyncStorage.getItem(account_storage_key(STORE_REVIEW_KEY, UID))) ?? "{}");
  expect(saved.asks).toBe(1);
  // Not again on the next close: asks are months apart.
  await close_reader();
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});

it("doesn't ask someone who has only used Votic on one or two days", async () => {
  await seed_active_days(["2026-11-01", "2026-11-02"]);
  await render_with_providers(<CloseReader />);
  await close_reader();
  expect(StoreReview.requestReview).not.toHaveBeenCalled();
});

it("offers 'Rate Votic on Google Play' in Feedback, opening Votic's Play page", async () => {
  Object.assign(Platform, { OS: "android" });
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render_with_providers(<FeedbackScreen />);
  await fireEvent.press(screen.getByRole("button", { name: /Rate Votic on Google Play/ }));
  expect(open).toHaveBeenCalledWith("market://details?id=com.votic.app");
});
