import { describe, expect, it } from "@jest/globals";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { chart_series, empty_log, period_for } from "../../src/activity/activityModel";
import { TimeChart } from "../../src/activity/TimeChart";
import { render_with_providers } from "../renderWithProviders";

describe("Statistics day labels", () => {
  it("shows readable weekly day numbers under a 31-day month instead of truncated labels", async () => {
    const now = new Date(2026, 9, 20);
    const points = chart_series(empty_log(), period_for("month", 0, now), now);
    await render_with_providers(<TimeChart points={points} title="Time for October" />);
    const labels = points.map((point) => screen.getByTestId(`label-${point.key}`));
    expect(labels.map((label) => label.props.children).filter((text) => text !== " ")).toEqual([
      "1",
      "8",
      "15",
      "22",
      "29",
    ]);
    // Each label has its own width rather than the bar slot's (about 1/31 of the chart), which caused "…".
    for (const label of labels) expect(StyleSheet.flatten(label.props.style).width).toBe(40);
    // Every day is still described for screen readers, labelled or not.
    expect(screen.getByRole("button", { name: "Saturday, Oct 31: no activity" })).toBeTruthy();
  });
});
