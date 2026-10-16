import { account_storage_key } from "../../src/storage/accountStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import Statistics from "../../app/statistics";
import { ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { add_ask_event, add_interval, empty_log, period_for } from "../../src/activity/activityModel";
import { router, searchParams } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

async function seed_activity() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60).getTime();
  let log = empty_log(start);
  const period = period_for("week", 0, now, start);
  const first = period.start.getTime() + 9 * 60 * 60_000;
  log = add_interval(log, "doc", "reading", first, first + 20 * 60_000);
  log = add_interval(log, "doc", "listening", first + 30 * 60_000, first + 40 * 60_000);
  log = add_ask_event(log, { at: first, category: "summary", newConversation: true });
  await AsyncStorage.setItem(account_storage_key(ACTIVITY_KEY, "test-user"), JSON.stringify(log));
  return log;
}

describe("Statistics activity overview", () => {
  it("draws reading and listening as side-by-side bars from the same baseline", async () => {
    await seed_activity();
    await render_with_providers(<Statistics />);
    const height = (id: RegExp) =>
      screen
        .getAllByTestId(id)
        .map((bar) => StyleSheet.flatten(bar.props.style).height as number)
        .filter((value) => value > 0);
    // 20 minutes reading and 10 listening: the scale tops out at 20 minutes, so reading fills the chart
    // and listening reaches halfway, each its own bar rather than one stacked on the other.
    expect(height(/^bar-.*-reading$/)).toEqual([132]);
    expect(height(/^bar-.*-listening$/)).toEqual([66]);
  });

  it("shows where reading and listening time comes from", async () => {
    await seed_activity();
    await render_with_providers(<Statistics />);
    expect(screen.getByRole("header", { name: "Where your time goes" })).toBeTruthy();
    // The seeded document isn't in the library, so its source is unknown rather than guessed.
    expect(screen.getByText("All of your time in this period was with earlier documents.")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Earlier documents, 30 minutes, 100 percent. Reading 20 minutes, listening 10 minutes, 1 document.",
      ),
    ).toBeTruthy();
  });

  it("shows accurate accessible totals and keeps the chart table available", async () => {
    const saved = await seed_activity();
    await render_with_providers(<Statistics />);
    expect(screen.getByRole("header", { name: "Your Votic activity" })).toBeTruthy();
    expect(screen.getByLabelText("Reading, 20 minutes")).toBeTruthy();
    expect(screen.getByLabelText("Listening, 10 minutes")).toBeTruthy();
    expect(screen.getByLabelText("Active days, 1")).toBeTruthy();
    expect(screen.getByLabelText("Questions asked, 1")).toBeTruthy();
    expect(screen.getByLabelText("Total time, 30 minutes")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Show as table" }));
    expect(screen.getByRole("button", { name: "Show chart" })).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(account_storage_key(ACTIVITY_KEY, "test-user")))!)).toEqual(
      saved,
    );
  });

  it("preserves period selection and carries the selected period into every detail route", async () => {
    await seed_activity();
    await render_with_providers(<Statistics />);
    await fireEvent.press(screen.getByRole("radio", { name: "Month" }));
    expect(screen.getByRole("radio", { name: "Month", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));
    for (const [label, section] of [
      ["Ask Votic", "ask"],
      ["Activity", "activity"],
      ["Documents", "documents"],
      ["Personal insights", "insights"],
    ]) {
      await fireEvent.press(screen.getByRole("button", { name: `${label} details` }));
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: "/statistics",
        params: { section, kind: "month", offset: "1" },
      });
    }
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    expect(screen.queryByRole("button", { name: "Previous month" })).toBeNull();
    expect(screen.getByRole("header", { name: "Your time, month by month" })).toBeTruthy();
  });

  it("offers an honest empty state instead of invented insights", async () => {
    await render_with_providers(<Statistics />, { reduceMotion: true });
    expect(screen.getByText("Start with a document. Your activity will appear here.")).toBeTruthy();
    expect(screen.getByText(/Your personal insights take shape after/)).toBeTruthy();
    expect(screen.queryByText(/You read and listen most in/)).toBeNull();
    expect(screen.getByLabelText("Questions asked, 0")).toBeTruthy();
  });

  it("shows a measured observation once the existing insight threshold is met", async () => {
    const now = new Date();
    let log = empty_log(new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime());
    for (let offset = 1; offset <= 3; offset++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 19).getTime();
      log = add_interval(log, "doc", "listening", at, at + 20 * 60_000);
    }
    await AsyncStorage.setItem(account_storage_key(ACTIVITY_KEY, "test-user"), JSON.stringify(log));
    searchParams.current = { kind: "all" };
    await render_with_providers(<Statistics />);
    expect(screen.getByText("You read and listen most in the evening.")).toBeTruthy();
  });

  it.each(["ask", "activity", "documents", "insights"])("preserves the %s detail screen", async (section) => {
    await seed_activity();
    searchParams.current = { section };
    await render_with_providers(<Statistics />);
    expect(screen.queryByRole("header", { name: "Your Votic activity" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Week", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
