import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Alert } from "react-native";
import Documents from "../../app/(tabs)/documents";
import Home from "../../app/(tabs)/index";
import Notes from "../../app/(tabs)/notes";
import Reader from "../../app/reader";
import Statistics from "../../app/statistics";
import { ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { ActivityLog, addAskEvent, addInterval, emptyLog, parseLog } from "../../src/activity/activityModel";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { router, searchParams } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
// The Reader grows out of the tapped card using on-screen measurements, which tests don't have.
jest.mock("../../src/documents/useDocumentImport", () => {
  const actual = jest.requireActual<typeof import("../../src/documents/useDocumentImport")>(
    "../../src/documents/useDocumentImport",
  );
  return {
    ...actual,
    openFrom: (_source: unknown, _transition: unknown, params?: Record<string, string>) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router: mockRouter } = require("../mocks/expoRouter");
      mockRouter.push(params ? { pathname: "/reader", params } : "/reader");
    },
  };
});

const MIN = 60_000;
const report = testDocument("doc-report", "q3_board-report_FINAL", {
  sourceName: "q3_board-report_FINAL.pdf",
  plainText:
    "Revenue grew this quarter. Costs held steady. The board approved the plan. Hiring resumes next month.",
  progress: 0.5,
  sentenceIndex: 1,
  lastOpenedAt: 5,
});
const guide = testDocument("doc-guide", "Field Guide", { progress: 1, lastOpenedAt: 2 });

async function seedActivity(log: ActivityLog) {
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
}

describe("Home", () => {
  it("restores the weekly statistics, horizontal files, and recent notes", async () => {
    const now = new Date();
    await seedActivity(addInterval(emptyLog(), report.id, "reading", now.getTime() - 5 * MIN, now.getTime()));
    const withNote = {
      ...report,
      savedPassages: [
        {
          id: "home-note",
          sentenceIndex: 1,
          text: "Costs held steady.",
          title: "Quarterly costs",
          note: "Review this before the meeting.",
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ],
    };
    await renderWithProviders(<Home />, { documents: [withNote, guide] });
    expect(screen.getByText("Statistics")).toBeTruthy();
    expect(screen.getByText(/Reading 5 min/, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(/Listening 0 min/, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Recent files" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Recent notes" })).toBeTruthy();
    expect(screen.getByText("Quarterly costs")).toBeTruthy();
    expect(screen.getAllByTestId("home-horizontal-shelf")).toHaveLength(2);
    for (const shelf of screen.getAllByTestId("home-horizontal-shelf"))
      expect(shelf.props.horizontal).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: /Quarterly costs\. From/ }));
    expect(router.push).toHaveBeenCalledWith("/reader");
  });

  it("features the document in progress with a readable title and resumes listening", async () => {
    await renderWithProviders(<Home />, { documents: [report, guide] });
    expect(screen.getByText("q3 board report FINAL")).toBeTruthy();
    expect(screen.getByText("Passage 2 of 4")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Resume listening to q3 board report FINAL" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/reader",
      params: { mode: "listen", autoplay: "1" },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Resume reading q3 board report FINAL" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/reader", params: { mode: "read" } });
  });

  it("links a quiet weekly summary to Statistics, including when there's no activity yet", async () => {
    await renderWithProviders(<Home />, { documents: [report] });
    const summary = screen.getByRole("button", { name: /This week: no reading or listening yet/ });
    await fireEvent.press(summary);
    expect(router.push).toHaveBeenCalledWith("/statistics");
  });

  it("offers one clear next action with an empty library", async () => {
    await renderWithProviders(<Home />);
    expect(screen.getByRole("header", { name: "Your reading starts here" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add document" })).toBeTruthy();
  });
});

describe("Documents", () => {
  it("renames a document while keeping its original filename in Details", async () => {
    await renderWithProviders(<Documents />, { documents: [report] });
    await fireEvent.press(screen.getByRole("button", { name: "More options for q3 board report FINAL" }));
    await fireEvent.press(screen.getByRole("button", { name: "Rename" }));
    await fireEvent.changeText(screen.getByLabelText("Document title"), "Q3 board report");
    await fireEvent.press(screen.getByRole("button", { name: "Save title" }));
    expect(screen.getByRole("button", { name: "Open Q3 board report" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "More options for Q3 board report" }));
    await fireEvent.press(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("q3_board-report_FINAL.pdf")).toBeTruthy();
  });

  it("moves a document into a new collection and filters by it", async () => {
    await renderWithProviders(<Documents />, { documents: [report, guide] });
    await fireEvent.press(screen.getByRole("button", { name: "More options for Field Guide" }));
    await fireEvent.press(screen.getByRole("button", { name: "Move to collection, currently Unfiled" }));
    await fireEvent.changeText(screen.getByLabelText("New collection name"), "Reference");
    await fireEvent.press(screen.getByRole("button", { name: "Create collection and move document" }));
    await fireEvent.press(screen.getByRole("button", { name: "Sort and filter" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Reference" }));
    await fireEvent.press(screen.getByRole("button", { name: "Show 1 document" }));
    expect(screen.getByText("1 document in Reference · Recently opened")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open q3 board report FINAL" })).toBeNull();
  });

  it("asks before deleting", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.text === "Delete")?.onPress?.();
    });
    await renderWithProviders(<Documents />, { documents: [report, guide] });
    await fireEvent.press(screen.getByRole("button", { name: "More options for Field Guide" }));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Delete" })));
    expect(alert).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open Field Guide" })).toBeNull();
  });

  it("explains when a search has no results", async () => {
    await renderWithProviders(<Documents />, { documents: [report] });
    await fireEvent.changeText(screen.getByLabelText("Search documents"), "zebra");
    expect(screen.getByText("No documents match “zebra”")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Show all documents" }));
    expect(screen.getByRole("button", { name: "Open q3 board report FINAL" })).toBeTruthy();
  });
});

describe("Notes", () => {
  it("shows a welcoming empty state without selection controls", async () => {
    await renderWithProviders(<Notes />, { documents: [report] });
    expect(screen.getByRole("header", { name: "Keep what matters." })).toBeTruthy();
    expect(
      screen.getByText("Save a passage or add a thought. Find it here, linked to your document."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select notes" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open a document" }));
    expect(router.push).toHaveBeenCalledWith("/documents");
  });

  it("previews each document's newest notes and keeps Notes or Saved passages in the filter panel", async () => {
    const passage = (id: string, note: string) => ({
      id,
      sentenceIndex: 0,
      text: `Passage ${id}.`,
      note,
      createdAt: 1,
      updatedAt: Number(id.slice(1)),
    });
    const noted = {
      ...report,
      savedPassages: [passage("p1", "First"), passage("p2", ""), passage("p3", "Third")],
    };
    await renderWithProviders(<Notes />, { documents: [noted] });
    expect(screen.getByRole("button", { name: "Show all 3 from q3 board report FINAL" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Saved Passages" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Saved passages" }));
    await fireEvent.press(screen.getByText("Show Results"));
    expect(screen.getByRole("button", { name: "Remove Saved passages filter" })).toBeTruthy();
    expect(screen.getByText("1 item from 1 document")).toBeTruthy();
  });
});

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}
async function layOutReader() {
  const layout = (y: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 390, height } },
  });
  await fireEvent(screen.getByTestId("reader-scroll"), "layout", layout(0, 600));
  for (const [index, passage] of screen.getByTestId("reader-document").children.entries())
    if (typeof passage !== "string") await fireEvent(passage, "layout", layout(index * 40, 40));
  await act(async () => jest.advanceTimersByTime(50));
}

describe("Reader measurement", () => {
  it("resumes listening from Home's link and records listening time", async () => {
    searchParams.current = { autoplay: "1" };
    await renderWithProviders(<OpenedReader />, { documents: [report], reduceMotion: true });
    await layOutReader();
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    // The Reader resumes at the saved passage.
    expect(jest.mocked(Speech.speak).mock.calls.at(-1)?.[0]).toBe("Costs held steady.");
    // Thirty seconds of narration, plus the two-second save delay.
    await act(async () => jest.advanceTimersByTime(32_500));
    await waitFor(async () => {
      const saved = parseLog(await AsyncStorage.getItem(ACTIVITY_KEY));
      const listening = Object.values(saved?.buckets ?? {}).reduce(
        (total, hour) => total + (hour[report.id]?.listening ?? 0),
        0,
      );
      // Playback starts a moment after the Reader mounts, so allow for that.
      expect(listening).toBeGreaterThanOrEqual(29_000);
    });
  });
});

describe("Statistics", () => {
  function realisticLog() {
    let log = emptyLog(new Date(2026, 8, 1).getTime());
    const now = new Date();
    for (let back = 0; back < 4; back += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 20);
      log = addInterval(
        log,
        report.id,
        "reading",
        day.getTime() - 3 * 3_600_000,
        day.getTime() - 3 * 3_600_000 + 8 * MIN,
      );
      log = addInterval(
        log,
        report.id,
        "listening",
        day.getTime() - 3 * 3_600_000 + 8 * MIN,
        day.getTime() - 3 * 3_600_000 + 20 * MIN,
      );
    }
    log = addAskEvent(log, {
      at: Date.now() - 1000,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    return log;
  }

  it("shows an overview, a chart with a text alternative, and previews", async () => {
    await seedActivity(realisticLog());
    await renderWithProviders(<Statistics />, { documents: [report] });
    expect(screen.getByRole("radio", { name: "Week", checked: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: "This week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByLabelText(/Total time, \d/)).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /reading \d+ minutes?, listening \d+ minutes?/ }).length,
    ).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole("button", { name: "Show as table" }));
    expect(screen.getByLabelText(/as a table$/)).toBeTruthy();
    expect(screen.getByLabelText("Questions, 1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Documents details" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/statistics",
      params: { section: "documents", kind: "week", offset: "0" },
    });
  });

  it("explains insufficient data instead of showing misleading insights", async () => {
    let log = emptyLog(Date.now() - 86_400_000);
    log = addInterval(log, report.id, "reading", Date.now() - 10 * MIN, Date.now() - 5 * MIN);
    await seedActivity(log);
    searchParams.current = { section: "insights" };
    await renderWithProviders(<Statistics />, { documents: [report] });
    expect(
      screen.getByText(
        /Insights appear after at least 30 minutes of reading or listening on 3 different days/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Votic started measuring on/)).toBeTruthy();
  });

  it("opens a ranked document from the Documents detail", async () => {
    await seedActivity(realisticLog());
    searchParams.current = { section: "documents" };
    await renderWithProviders(<Statistics />, { documents: [report] });
    await fireEvent.press(screen.getByRole("button", { name: /^1\. q3 board report FINAL/ }));
    expect(router.push).toHaveBeenCalledWith("/reader");
  });

  it("shows the activity calendar and streaks", async () => {
    await seedActivity(realisticLog());
    searchParams.current = { section: "activity" };
    await renderWithProviders(<Statistics />, { documents: [report] });
    expect(screen.getByLabelText("Current streak, 4 days")).toBeTruthy();
    const today = new Date();
    expect(
      screen.getByLabelText(`${today.toLocaleString("en-US", { month: "long" })} ${today.getDate()}, active`),
    ).toBeTruthy();
  });
});
