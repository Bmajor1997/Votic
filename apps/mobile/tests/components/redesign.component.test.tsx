import { account_storage_key } from "../../src/storage/accountStorage";
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
import {
  ActivityLog,
  add_ask_event,
  add_interval,
  empty_log,
  parse_log,
} from "../../src/activity/activityModel";
import { LIBRARY_KEY } from "../../src/documents/documentStorage";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { router, searchParams } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

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
    open_from: (_source: unknown, _transition: unknown, params?: Record<string, string>) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router: mockRouter } = require("../mocks/expoRouter");
      mockRouter.push(params ? { pathname: "/reader", params } : "/reader");
    },
  };
});

const MIN = 60_000;
const report = test_document("doc-report", "q3_board-report_FINAL", {
  sourceName: "q3_board-report_FINAL.pdf",
  plainText:
    "Revenue grew this quarter. Costs held steady. The board approved the plan. Hiring resumes next month.",
  progress: 0.5,
  sentenceIndex: 1,
  lastOpenedAt: 5,
});
const guide = test_document("doc-guide", "Field Guide", { progress: 1, lastOpenedAt: 2 });

async function seed_activity(log: ActivityLog) {
  await AsyncStorage.setItem(account_storage_key(ACTIVITY_KEY, "test-user"), JSON.stringify(log));
}

describe("Home", () => {
  it("restores the weekly statistics, horizontal files, and recent notes", async () => {
    const now = new Date();
    await seed_activity(
      add_interval(empty_log(), report.id, "reading", now.getTime() - 5 * MIN, now.getTime()),
    );
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
    await render_with_providers(<Home />, { documents: [withNote, guide] });
    expect(screen.queryByRole("button", { name: "Add document" })).toBeNull();
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
    await render_with_providers(<Home />, { documents: [report, guide] });
    expect(screen.getByText("q3 board report FINAL")).toBeTruthy();
    expect(screen.getByText("Passage 2 of 4")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue Listening: q3 board report FINAL" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/reader",
      params: { mode: "listen", autoplay: "1" },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Continue Reading: q3 board report FINAL" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/reader", params: { mode: "read" } });
  });

  it("links a quiet weekly summary to Statistics, including when there's no activity yet", async () => {
    await render_with_providers(<Home />, { documents: [report] });
    const summary = screen.getByRole("button", { name: /This week: no reading or listening yet/ });
    await fireEvent.press(summary);
    expect(router.push).toHaveBeenCalledWith("/statistics");
  });
});

describe("Documents", () => {
  it("says the page is empty when there are no documents", async () => {
    await render_with_providers(<Documents />);
    expect(screen.getByRole("header", { name: "Your Documents page is empty" })).toBeTruthy();
    expect(
      screen.getByText(
        "Add a file from your device or a connected cloud storage provider to read and listen.",
      ),
    ).toBeTruthy();
  });

  it.each(["read", "listen"] as const)(
    "offers a choice and opens the selected document in %s mode",
    async (mode) => {
      await render_with_providers(<Documents />, { documents: [report, guide] });
      await fireEvent.press(screen.getByRole("button", { name: "Open q3 board report FINAL" }));
      expect(router.push).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Read" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: mode === "read" ? "Read" : "Listen" }));
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenLastCalledWith({ pathname: "/reader", params: { mode } });
      expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
      await waitFor(async () => {
        const saved = JSON.parse(
          (await AsyncStorage.getItem(account_storage_key(LIBRARY_KEY, "test-user"))) || "[]",
        );
        const selected = saved.find((item: { id: string }) => item.id === report.id);
        expect(selected).toMatchObject({ id: report.id, sentenceIndex: 1, progress: 0.5 });
        expect(selected.lastOpenedAt).toBeGreaterThan(5);
      });
    },
  );

  it("cancels without opening a document and also offers the choice from document options", async () => {
    await render_with_providers(<Documents />, { documents: [report] });
    await fireEvent.press(screen.getByRole("button", { name: "Open q3 board report FINAL" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "More options for q3 board report FINAL" }));
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Read" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
  });

  it("renames a document while keeping its original filename in Details", async () => {
    await render_with_providers(<Documents />, { documents: [report] });
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
    await render_with_providers(<Documents />, { documents: [report, guide] });
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

  it("reuses a collection whose name differs only in capitals instead of filing under a name that isn't saved", async () => {
    await render_with_providers(<Documents />, { documents: [report, guide] });
    await fireEvent.press(screen.getByRole("button", { name: "More options for Field Guide" }));
    await fireEvent.press(screen.getByRole("button", { name: "Move to collection, currently Unfiled" }));
    await fireEvent.changeText(screen.getByLabelText("New collection name"), "Reference");
    await fireEvent.press(screen.getByRole("button", { name: "Create collection and move document" }));
    await fireEvent.press(screen.getByRole("button", { name: "More options for q3 board report FINAL" }));
    await fireEvent.press(screen.getByRole("button", { name: "Move to collection, currently Unfiled" }));
    await fireEvent.changeText(screen.getByLabelText("New collection name"), "reference ");
    await fireEvent.press(screen.getByRole("button", { name: "Create collection and move document" }));
    await fireEvent.press(screen.getByRole("button", { name: "New collection" }));
    await fireEvent.changeText(screen.getByLabelText("Collection name"), "REFERENCE");
    await fireEvent.press(screen.getByRole("button", { name: "Save collection" }));
    expect(screen.getByText("2 documents in Reference · Recently opened")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: /^Sort and filter/ }));
    expect(screen.getAllByRole("radio", { name: /reference/i })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Reference", checked: true })).toBeTruthy();
  });

  it("shows only finished documents on the Finished shelf", async () => {
    const finished = { ...guide, progress: 1, completedAt: 5 };
    await render_with_providers(<Documents />, { documents: [report, finished] });
    await fireEvent.press(screen.getByRole("button", { name: "Sort and filter" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Finished" }));
    await fireEvent.press(screen.getByRole("button", { name: "Show 1 document" }));
    expect(screen.getByText("1 finished document · Recently opened")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Field Guide" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open q3 board report FINAL" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Reset sort and filter" }));
    expect(screen.getByRole("button", { name: "Open q3 board report FINAL" })).toBeTruthy();
  });

  it("asks before deleting", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((button) => button.text === "Delete")?.onPress?.();
    });
    await render_with_providers(<Documents />, { documents: [report, guide] });
    await fireEvent.press(screen.getByRole("button", { name: "More options for Field Guide" }));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Delete" })));
    expect(alert).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open Field Guide" })).toBeNull();
  });

  it("explains when a search has no results", async () => {
    await render_with_providers(<Documents />, { documents: [report] });
    await fireEvent.changeText(screen.getByLabelText("Search documents"), "zebra");
    expect(screen.getByText("No documents match “zebra”")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Show all documents" }));
    expect(screen.getByRole("button", { name: "Open q3 board report FINAL" })).toBeTruthy();
  });
});

describe("Notes", () => {
  it("shows a welcoming empty state without selection controls", async () => {
    await render_with_providers(<Notes />, { documents: [report] });
    expect(screen.getByText("No notes yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select notes" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open q3 board report FINAL notebook" }));
    expect(screen.getByRole("header", { name: "Your notes will appear here" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quick Note" })).toBeNull();
  });

  it("opens each document’s notebook and keeps Notes or Saved passages in the filter panel", async () => {
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
    await render_with_providers(<Notes />, { documents: [noted] });
    expect(screen.getByText("2 notes · 1 passage")).toBeTruthy();
    expect(screen.queryByText("Third")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open q3 board report FINAL notebook" }));
    expect(screen.getAllByText("Third").length).toBeGreaterThan(0);
    expect(screen.getAllByText("First").length).toBeGreaterThan(0);
    expect(screen.queryByRole("radio", { name: "Saved Passages" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Saved passages" }));
    await fireEvent.press(screen.getByText("Show Results"));
    expect(screen.getByRole("button", { name: "Remove Saved passages filter" })).toBeTruthy();
    expect(screen.getByText("1 saved passage in 1 notebook")).toBeTruthy();
  });
});

function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}
async function lay_out_reader() {
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
    await render_with_providers(<OpenedReader />, { documents: [report], reduceMotion: true });
    await lay_out_reader();
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    // The Reader resumes at the saved passage.
    expect(jest.mocked(Speech.speak).mock.calls.at(-1)?.[0]).toBe("Costs held steady.");
    // Thirty seconds of narration, plus the two-second save delay.
    await act(async () => jest.advanceTimersByTime(32_500));
    await waitFor(async () => {
      const saved = parse_log(await AsyncStorage.getItem(account_storage_key(ACTIVITY_KEY, "test-user")));
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
  function realistic_log() {
    let log = empty_log(new Date(2026, 8, 1).getTime());
    const now = new Date();
    for (let back = 0; back < 4; back += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 20);
      log = add_interval(
        log,
        report.id,
        "reading",
        day.getTime() - 3 * 3_600_000,
        day.getTime() - 3 * 3_600_000 + 8 * MIN,
      );
      log = add_interval(
        log,
        report.id,
        "listening",
        day.getTime() - 3 * 3_600_000 + 8 * MIN,
        day.getTime() - 3 * 3_600_000 + 20 * MIN,
      );
    }
    log = add_ask_event(log, {
      at: Date.now() - 1000,
      category: "summary",
      prompt: "Summarize this document",
      newConversation: true,
    });
    return log;
  }

  it("shows an overview, a chart with a text alternative, and previews", async () => {
    await seed_activity(realistic_log());
    await render_with_providers(<Statistics />, { documents: [report] });
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
    expect(screen.getByLabelText("Questions asked, 1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Documents details" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/statistics",
      params: { section: "documents", kind: "week", offset: "0" },
    });
  });

  it("explains insufficient data instead of showing misleading insights", async () => {
    let log = empty_log(Date.now() - 86_400_000);
    log = add_interval(log, report.id, "reading", Date.now() - 10 * MIN, Date.now() - 5 * MIN);
    await seed_activity(log);
    searchParams.current = { section: "insights" };
    await render_with_providers(<Statistics />, { documents: [report] });
    expect(
      screen.getByText(
        /Insights appear after at least 30 minutes of reading or listening on 3 different days/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/So far: 5 min on 1 day\./)).toBeTruthy();
  });

  it("opens a ranked document from the Documents detail", async () => {
    await seed_activity(realistic_log());
    searchParams.current = { section: "documents" };
    await render_with_providers(<Statistics />, { documents: [report] });
    await fireEvent.press(screen.getByRole("button", { name: /^1\. q3 board report FINAL/ }));
    expect(router.push).toHaveBeenCalledWith("/reader");
  });

  it("shows the activity calendar and streaks", async () => {
    await seed_activity(realistic_log());
    searchParams.current = { section: "activity" };
    await render_with_providers(<Statistics />, { documents: [report] });
    expect(screen.getByLabelText("Current streak, 4 days")).toBeTruthy();
    const today = new Date();
    expect(
      screen.getByLabelText(`${today.toLocaleString("en-US", { month: "long" })} ${today.getDate()}, active`),
    ).toBeTruthy();
  });
});
