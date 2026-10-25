import { account_storage_key } from "../../src/storage/accountStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { screen } from "@testing-library/react-native";
import Statistics from "../../app/statistics";
import { ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { add_interval, empty_log, period_for } from "../../src/activity/activityModel";
import { WeekWidget } from "../../src/home/HomeWidgets";
import { render_with_providers } from "../renderWithProviders";

const MIN = 60_000;

/** Reading and listening this week in fractional minutes, starting 9 a.m. on the week's first day. */
async function seed_week(readingMinutes: number, listeningMinutes: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
  const first = period_for("week", 0, now, start).start.getTime() + 9 * 60 * MIN;
  let log = add_interval(empty_log(start), "doc", "reading", first, first + readingMinutes * MIN);
  const listenStart = first + 60 * MIN;
  log = add_interval(log, "doc", "listening", listenStart, listenStart + listeningMinutes * MIN);
  await AsyncStorage.setItem(account_storage_key(ACTIVITY_KEY, "test-user"), JSON.stringify(log));
}

async function home_total() {
  const view = await render_with_providers(<WeekWidget />);
  const text = screen.getByTestId("home-week-total").props.children as string;
  await view.unmount();
  return text;
}
async function statistics_total() {
  await render_with_providers(<Statistics />);
  return screen.getByTestId("statistics-total").props.children as string;
}

describe("weekly time totals", () => {
  it.each([
    // Reading and listening each show completed minutes, and the total is their sum, so the three figures always
    // agree: 2.6 + 1.6 minutes shows "2 min" + "1 min" and a total of 3 min. Nothing is ever rounded up.
    [2.6, 1.6, "3 min"],
    [2.4, 2.4, "4 min"],
    // 36 seconds is not a minute.
    [0.3, 0.3, "under 1 min"],
    [0.2, 0.1, "under 1 min"],
    [59.6, 0.3, "59 min"],
    [59.6, 0.4, "59 min"],
    [60, 0.4, "1 h"],
  ])("Home and Statistics agree for %s min reading + %s min listening", async (reading, listening, shown) => {
    await seed_week(reading, listening);
    expect(await home_total()).toBe(shown);
    expect(await statistics_total()).toBe(shown);
  });
});
