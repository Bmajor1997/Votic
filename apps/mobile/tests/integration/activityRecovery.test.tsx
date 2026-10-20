import AsyncStorage from "@react-native-async-storage/async-storage";
import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";
import { ACTIVITY_KEY, useActivity } from "../../src/activity/ActivityProvider";
import { add_interval, empty_log } from "../../src/activity/activityModel";
import { account_storage_key } from "../../src/storage/accountStorage";
import { render_with_providers } from "../renderWithProviders";

function ActivityProbe() {
  const { hydrated, loadError, retryLoad, recordAsk, measuredLog } = useActivity();
  return (
    <View>
      <Text>{loadError ?? (hydrated ? "Loaded" : "Loading")}</Text>
      <Text testID="history">{JSON.stringify(measuredLog)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retryLoad} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record"
        onPress={() => recordAsk({ at: 1, category: "summary", newConversation: true })}
      />
    </View>
  );
}
it("preserves history after a failed read, then recovers it and queued activity on retry", async () => {
  const key = account_storage_key(ACTIVITY_KEY, "test-user");
  const original = add_interval(empty_log(1), "doc", "reading", 1000, 61000);
  await AsyncStorage.setItem(key, JSON.stringify(original));
  const read = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
  const spy = jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (name) => {
    if (name === key) throw new Error("Temporary storage failure");
    return read(name);
  });
  await render_with_providers(<ActivityProbe />);
  expect(screen.getByText(/saved history has been kept/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Record" }));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(await read(key)).toBe(JSON.stringify(original));
  spy.mockImplementation(read);
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(screen.getByText("Loaded")).toBeTruthy();
  const recovered = JSON.parse(screen.getByTestId("history").props.children);
  expect(recovered.buckets).toEqual(original.buckets);
  expect(recovered.ask).toHaveLength(1);
});
it("keeps malformed history intact instead of replacing it with an empty log", async () => {
  const key = account_storage_key(ACTIVITY_KEY, "test-user");
  await AsyncStorage.setItem(key, "{broken");
  await render_with_providers(<ActivityProbe />);
  expect(screen.getByText(/saved history has been kept/)).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(await AsyncStorage.getItem(key)).toBe("{broken");
});
