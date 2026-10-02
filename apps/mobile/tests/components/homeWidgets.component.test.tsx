import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, within } from "@testing-library/react-native";
import Home from "../../app/(tabs)/index";
import { ACTIVITY_KEY } from "../../src/activity/ActivityProvider";
import { ActivityLog, addInterval, emptyLog } from "../../src/activity/activityModel";
import { router } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

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
const longText = Array.from({ length: 40 }, (_, index) => `Sentence number ${index + 1} of the report.`).join(
  " ",
);
const report = testDocument("doc-report", "Quarterly report", {
  plainText: longText,
  progress: 0.4,
  sentenceIndex: 15,
  lastOpenedAt: 9,
});
const guide = testDocument("doc-guide", "Field Guide", { progress: 1, lastOpenedAt: 5 });
const notebook = testDocument("doc-notes", "Biology", {
  lastOpenedAt: 3,
  savedPassages: [
    {
      id: "p-1",
      sentenceIndex: 1,
      text: "Cells divide.",
      note: "Mitosis basics",
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: "p-0",
      sentenceIndex: 0,
      text: "Energy comes from ATP.",
      note: "",
      title: "Remember for the exam",
      createdAt: 1,
      updatedAt: 1,
      pinned: true,
    },
  ],
});

async function seedActivity(log: ActivityLog) {
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
}

describe("Continue", () => {
  it("puts reading first when the document was last read", async () => {
    await renderWithProviders(<Home />, { documents: [report] });
    const actions = screen.getAllByRole("button", {
      name: /^Resume (reading|listening to) Quarterly report$/,
    });
    expect(actions.map((button) => button.props.accessibilityLabel)).toEqual([
      "Resume reading Quarterly report",
      "Resume listening to Quarterly report",
    ]);
    expect(screen.getByText(/% · about \d+ min left/)).toBeTruthy();
  });

  it("puts listening first, and says so, when the document was last listened to", async () => {
    const now = Date.now();
    await seedActivity(addInterval(emptyLog(0), report.id, "listening", now - 20 * MIN, now - 10 * MIN));
    await renderWithProviders(<Home />, { documents: [report] });
    const actions = screen.getAllByRole("button", {
      name: /^Resume (reading|listening to) Quarterly report$/,
    });
    expect(actions[0].props.accessibilityLabel).toBe("Resume listening to Quarterly report");
    expect(screen.getByText(/Listened today/)).toBeTruthy();
    await fireEvent.press(actions[0]);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/reader",
      params: { mode: "listen", autoplay: "1" },
    });
  });

  it("isn't shown when everything is finished", async () => {
    await renderWithProviders(<Home />, { documents: [guide] });
    expect(screen.queryByRole("button", { name: /^Resume/ })).toBeNull();
    // The most recent document is still a tap away.
    expect(screen.getByRole("button", { name: "Open Field Guide" })).toBeTruthy();
  });
});

describe("Ask Votic", () => {
  it("isn't on Home", async () => {
    await renderWithProviders(<Home />, { documents: [report, guide] });
    expect(screen.queryByRole("button", { name: /^Ask Votic/ })).toBeNull();
  });
});

describe("This week", () => {
  it("shows the week's time, the split, and opens Statistics", async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30).getTime();
    let log = addInterval(emptyLog(0), report.id, "reading", today, today + 40 * MIN);
    log = addInterval(log, report.id, "listening", today + 60 * MIN, today + 80 * MIN);
    await seedActivity(log);
    await renderWithProviders(<Home />, { documents: [report] });
    const week = screen.getByRole("button", { name: /^This week: 1 hour/ });
    expect(within(week).getByText("1 h")).toBeTruthy();
    expect(within(week).getByText("Reading 40 min", { includeHiddenElements: true })).toBeTruthy();
    expect(week.props.accessibilityLabel).toMatch(/reading 40 minutes, listening 20 minutes/);
    expect(within(week).getByText("Listening 20 min", { includeHiddenElements: true })).toBeTruthy();
    expect(within(week).getByText("Statistics")).toBeTruthy();
    await fireEvent.press(week);
    expect(router.push).toHaveBeenLastCalledWith("/statistics");
  });

  it("doesn't invent an insight from a little activity", async () => {
    const now = Date.now();
    await seedActivity(addInterval(emptyLog(0), report.id, "listening", now - 5 * MIN, now));
    await renderWithProviders(<Home />, { documents: [report] });
    expect(screen.queryByText(/Most of your time/)).toBeNull();
  });
});

describe("Recent and notes", () => {
  it("lists recent documents other than the one in Continue", async () => {
    await renderWithProviders(<Home />, { documents: [report, guide, notebook] });
    expect(screen.getByRole("button", { name: "Open Field Guide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Biology" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Quarterly report" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "See all documents" }));
    expect(router.push).toHaveBeenLastCalledWith("/documents");
  });

  it("surfaces pinned notes first and opens the document at the note", async () => {
    await renderWithProviders(<Home />, { documents: [report, notebook] });
    expect(screen.getByRole("header", { name: "From your notes" })).toBeTruthy();
    const notes = screen.getAllByRole("button", { name: /From Biology/ });
    expect(notes[0].props.accessibilityLabel).toMatch(/^Pinned note\. Remember for the exam\./);
    expect(notes[1].props.accessibilityLabel).toMatch(/^Mitosis basics\./);
    await fireEvent.press(notes[1]);
    expect(router.push).toHaveBeenLastCalledWith("/reader");
  });

  it("leaves notes off Home until there are some", async () => {
    await renderWithProviders(<Home />, { documents: [report] });
    expect(screen.queryByRole("header", { name: "From your notes" })).toBeNull();
  });
});
