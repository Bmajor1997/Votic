import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Documents from "../../app/(tabs)/documents";
import Home from "../../app/(tabs)/index";
import Notes from "../../app/(tabs)/notes";
import Reader from "../../app/reader";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { DEVICE_HISTORY_KEY } from "../../src/onboarding/OnboardingProvider";
import { LearnVoticSettings } from "../../src/walkthrough/LearnVoticSettings";
import { FlowId } from "../../src/walkthrough/walkthroughFlows";
import { WalkthroughOverlay } from "../../src/walkthrough/WalkthroughOverlay";
import {
  ALL_SET_DELAY_MS,
  MeasureNode,
  TRIGGER_DELAY_MS,
  useWalkthrough,
} from "../../src/walkthrough/WalkthroughProvider";
import { WALKTHROUGH_KEY } from "../../src/walkthrough/walkthroughState";
import { router, searchParams } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

/** Which real controls the walkthrough measured, by accessibility label. */
let measured: string[] = [];
const measureNode: MeasureNode = async (node) => {
  const label = (node as { props?: { accessibilityLabel?: string } } | null)?.props?.accessibilityLabel;
  if (label) measured.push(label);
  return { x: 20, y: 300, width: 120, height: 44 };
};

/** The tab bar is drawn by the navigator; this stands in for the tab layout's registration. */
function TabTargets() {
  const { registerTarget } = useWalkthrough();
  useEffect(() => {
    registerTarget("tab.documents", async () => {
      measured.push("Documents tab");
      return { x: 98, y: 780, width: 98, height: 64 };
    });
    registerTarget("tab.notes", async () => {
      measured.push("Notes tab");
      return { x: 196, y: 780, width: 98, height: 64 };
    });
  }, [registerTarget]);
  return null;
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}
/** Lets the screen's trigger delay and the overlay's measuring finish. */
async function waitForWalkthrough() {
  await settle();
  await act(async () => jest.advanceTimersByTime(TRIGGER_DELAY_MS + 350));
  await settle();
}
async function renderTab(
  ui: React.ReactElement,
  setup: { documents?: ReturnType<typeof testDocument>[] } = {},
) {
  const result = await renderWithProviders(
    <>
      {ui}
      <TabTargets />
      <WalkthroughOverlay host="tabs" />
    </>,
    { walkthrough: "fresh", measureNode, ...setup },
  );
  await waitForWalkthrough();
  return result;
}
async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await settle();
}
async function saved(): Promise<Partial<Record<FlowId, { status: string }>>> {
  return JSON.parse((await AsyncStorage.getItem(WALKTHROUGH_KEY)) || "{}").flows || {};
}
const card = () => screen.queryByTestId("walkthrough-card");
/** Text inside the walkthrough card (the screen itself may say the same thing). */
const inCard = (text: string) => within(screen.getByTestId("walkthrough-card")).getByText(text);
const WITH_NOTES = [
  testDocument("d1", "Biology", {
    savedPassages: [
      { id: "passage-0", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
    ],
  }),
];

/** A new person who chose "Show me around" on the welcome card. */
const AFTER_INTRO = { version: 1, flows: { intro: { status: "completed", at: 1 } } };

beforeEach(async () => {
  measured = [];
  await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "new");
  await AsyncStorage.setItem(WALKTHROUGH_KEY, JSON.stringify(AFTER_INTRO));
});

describe("Let's show you around", () => {
  async function brandNew() {
    await AsyncStorage.removeItem(WALKTHROUGH_KEY);
    await renderTab(<Home />);
  }

  it("comes before any Home coaching for a brand-new person", async () => {
    await brandNew();
    expect(screen.getByText("Let's show you around")).toBeTruthy();
    expect(
      screen.getByText("We'll show you around as you explore, so you can learn Votic as you use it."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show me around" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I'll explore on my own" })).toBeTruthy();
    expect(screen.queryByText("Welcome to Home")).toBeNull();
  });

  it("'Show me around' leads into the Home walkthrough, and the welcome shows only once", async () => {
    await brandNew();
    await press("Show me around");
    expect(screen.queryByText("Let's show you around")).toBeNull();
    await waitForWalkthrough();
    expect(screen.getByText("Welcome to Home")).toBeTruthy();
    expect((await saved()).intro?.status).toBe("completed");
    // Documents, Notes, and the Reader still wait until they're reached.
    expect((await saved()).documents).toBeUndefined();
    screen.unmount();
    await renderTab(<Home />);
    expect(screen.queryByText("Let's show you around")).toBeNull();
    expect(screen.getByText("Welcome to Home")).toBeTruthy();
  });

  it("'I'll explore on my own' turns off automatic coaching without marking anything learned", async () => {
    await brandNew();
    await press("I'll explore on my own");
    await waitForWalkthrough();
    expect(card()).toBeNull();
    expect(await saved()).toEqual({ intro: expect.objectContaining({ status: "skipped" }) });
    screen.unmount();
    await renderTab(<Documents />);
    expect(card()).toBeNull();
    screen.unmount();
    await renderTab(<Notes />, { documents: WITH_NOTES });
    await press("Select notes");
    await waitForWalkthrough();
    expect(card()).toBeNull();
  });

  it("Learn Votic still replays a walkthrough after declining", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({ version: 1, flows: { intro: { status: "skipped", at: 1 } } }),
    );
    function SettingsThenDocuments() {
      const [onDocuments, setOnDocuments] = useState(false);
      useEffect(() => {
        router.push.mockImplementation(() => setOnDocuments(true));
      }, []);
      return onDocuments ? <Documents /> : <LearnVoticSettings />;
    }
    await renderTab(<SettingsThenDocuments />);
    await press("Replay the Documents walkthrough");
    await waitForWalkthrough();
    expect(inCard("Add your first document")).toBeTruthy();
  });

  it("isn't shown to people whose walkthrough progress was saved before it existed", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({ version: 1, flows: { home: { status: "completed", at: 1 } } }),
    );
    await renderTab(<Home />);
    expect(card()).toBeNull();
    expect((await saved()).intro?.status).toBe("migrated");
  });

  it("comes back with 'Show all walkthroughs and tips again'", async () => {
    await renderWithProviders(<LearnVoticSettings />);
    await settle();
    await press("Show all walkthroughs and tips again");
    expect(await saved()).toEqual({});
    screen.unmount();
    await renderTab(<Home />);
    expect(screen.getByText("Let's show you around")).toBeTruthy();
  });
});

describe("Home walkthrough", () => {
  it("orients a new person on their first visit, then stays finished", async () => {
    await renderTab(<Home />);
    expect(screen.getByText("Welcome to Home")).toBeTruthy();
    expect(screen.getByText("Start here. Add a document, and Votic opens it in the Reader.")).toBeTruthy();
    expect(screen.getByLabelText("Step 1 of 3")).toBeTruthy();
    await press("Next");
    expect(screen.getByText("Your documents")).toBeTruthy();
    expect(measured).toContain("Documents tab");
    await press("Next");
    expect(screen.getByText("Your notes")).toBeTruthy();
    expect(measured).toContain("Notes tab");
    await press("Got it");
    expect(card()).toBeNull();
    // Only Home is finished; the other areas are taught when they're reached.
    expect(await saved()).toEqual({
      intro: expect.objectContaining({ status: "completed" }),
      home: expect.objectContaining({ status: "completed" }),
    });

    screen.unmount();
    await renderWithProviders(
      <>
        <Home />
        <WalkthroughOverlay host="tabs" />
      </>,
      { walkthrough: "fresh", measureNode },
    );
    await waitForWalkthrough();
    expect(card()).toBeNull();
  });

  it("starts with Continue Reading when there's a document in progress", async () => {
    await renderTab(<Home />, {
      documents: [testDocument("d1", "Biology", { progress: 0.3, lastOpenedAt: 5 })],
    });
    expect(
      screen.getByText(
        "Pick up where you left off. Listen plays from your spot, and Read opens it without audio controls.",
      ),
    ).toBeTruthy();
    await press("Next");
    // Home's weekly summary leads to Statistics.
    expect(screen.getByText("Your week")).toBeTruthy();
  });

  it("covers the Recent shelf and notes when Home has them", async () => {
    await renderTab(<Home />, {
      documents: [
        testDocument("d1", "Biology", { progress: 0.3, lastOpenedAt: 5 }),
        testDocument("d2", "Field Guide", {
          lastOpenedAt: 2,
          savedPassages: [
            {
              id: "passage-0",
              sentenceIndex: 0,
              text: "Cells.",
              note: "Mitosis",
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ],
    });
    const titles = [screen.getAllByRole("header").at(-1)!.props.children];
    for (let step = 0; step < 4; step += 1) {
      if (titles.at(-1) === "From your notes")
        expect(
          screen.getByText(
            "Pinned and recent notes show up here. Tap one to go back to that spot in its document.",
          ),
        ).toBeTruthy();
      await press("Next");
      titles.push(screen.getAllByRole("header").at(-1)!.props.children);
    }
    expect(titles).toEqual([
      "Welcome to Home",
      "Your week",
      "Recent documents",
      "From your notes",
      "Your documents",
    ]);
  });

  it("skipping Home leaves Documents, Notes, and the Reader to be taught later", async () => {
    await renderTab(<Home />);
    await press("Skip walkthrough");
    expect(card()).toBeNull();
    expect(await saved()).toEqual({
      intro: expect.objectContaining({ status: "completed" }),
      home: expect.objectContaining({ status: "skipped" }),
    });
    screen.unmount();
    await renderTab(<Documents />);
    expect(inCard("Add your first document")).toBeTruthy();
  });
});

describe("Documents walkthrough", () => {
  it("waits until Documents is visited, and points at the real Upload button", async () => {
    await renderTab(<Home />);
    expect(screen.queryByText("Add your first document")).toBeNull();
    screen.unmount();
    await renderTab(<Documents />);
    expect(inCard("Add your first document")).toBeTruthy();
    expect(measured).toContain("Upload document");
    // Upload can be used for real through the spotlight.
    expect(
      screen.getByTestId("walkthrough-spotlight", { includeHiddenElements: true }).props.pointerEvents,
    ).toBe("none");
    await press("Got it");
    expect((await saved()).documents?.status).toBe("completed");
  });

  it("shows search and sorting once there are documents", async () => {
    await renderTab(<Documents />, { documents: [testDocument("d1", "Biology")] });
    expect(screen.getByText("Add documents")).toBeTruthy();
    await press("Next");
    expect(screen.getByText("Find documents")).toBeTruthy();
    // Other steps only explain; the control can't be pressed by accident.
    expect(
      screen.getByTestId("walkthrough-spotlight", { includeHiddenElements: true }).props.pointerEvents,
    ).toBe("auto");
    await press("Next");
    expect(screen.getByText("Sort and filter")).toBeTruthy();
    expect(measured).toContain("Sort and filter");
    await press("Got it");
    expect((await saved()).documents?.status).toBe("completed");
  });

  it("finishes when the person taps Upload", async () => {
    await renderTab(<Documents />);
    await press("Upload document");
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled();
    expect(card()).toBeNull();
    expect((await saved()).documents?.status).toBe("completed");
  });

  it("shows again from the start if the person leaves before finishing", async () => {
    await renderTab(<Documents />, { documents: [testDocument("d1", "Biology")] });
    await press("Next");
    screen.unmount();
    expect((await saved()).documents).toBeUndefined();
    await renderTab(<Documents />, { documents: [testDocument("d1", "Biology")] });
    expect(screen.getByText("Add documents")).toBeTruthy();
  });

  it("teaches collections on a later visit, once there are documents", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({ version: 1, flows: { documents: { status: "completed", at: 1 } } }),
    );
    await renderTab(<Documents />, { documents: [testDocument("d1", "Biology")] });
    expect(screen.getByText("Organize with collections")).toBeTruthy();
    expect(measured).toContain("New collection");
    await press("Next");
    expect(screen.getByText("Move a document")).toBeTruthy();
    expect(measured).toContain("More options for Biology");
    await press("Next");
    expect(screen.getByText("Browse by collection")).toBeTruthy();
    await press("Got it");
    expect((await saved())["documents.collections"]?.status).toBe("completed");
  });
});

describe("Notes walkthrough", () => {
  it("waits until Notes is visited and explains where notes come from", async () => {
    await renderTab(<Documents />);
    expect(screen.queryByText("Notes start in the Reader")).toBeNull();
    screen.unmount();
    await renderTab(<Notes />);
    expect(screen.getByText("Notes start in the Reader")).toBeTruthy();
    await press("Got it");
    expect(Object.keys(await saved()).sort()).toEqual(["intro", "notes"]);
  });

  it("explains source-linked notes when there are notes", async () => {
    const documents = [
      testDocument("d1", "Biology", {
        savedPassages: [
          { id: "passage-0", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
        ],
      }),
    ];
    await renderTab(<Notes />, { documents });
    expect(screen.getByText("Notes stay with their source")).toBeTruthy();
    await press("Next");
    expect(screen.getByText("Find a note")).toBeTruthy();
    await press("Next");
    expect(screen.getByText("Ask about your notes")).toBeTruthy();
    expect(measured).toContain("Ask Votic about notes");
  });

  it("explains pinning the first time a note is pinned", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({ version: 1, flows: { notes: { status: "completed", at: 1 } } }),
    );
    const documents = [
      testDocument("d1", "Biology", {
        savedPassages: [
          { id: "passage-0", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
        ],
      }),
    ];
    await renderTab(<Notes />, { documents });
    expect(card()).toBeNull();
    await press("More options for note");
    await fireEvent.press(screen.getByText("Pin note"));
    await waitForWalkthrough();
    expect(
      screen.getByText("Pinned notes stay easy to find. Choose Pinned in Filters to see only them."),
    ).toBeTruthy();
  });

  it("offers the Ask Votic tip the first time notes are selected", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({ version: 1, flows: { notes: { status: "completed", at: 1 } } }),
    );
    await renderTab(<Notes />, { documents: WITH_NOTES });
    await press("Select notes");
    await waitForWalkthrough();
    expect(screen.getByText("Ask about your notes")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose notes, then tap Ask Votic to ask about just those notes, or Share to send them.",
      ),
    ).toBeTruthy();
    await press("Got it");
    await press("Cancel note selection");
    await press("Select notes");
    await waitForWalkthrough();
    expect(card()).toBeNull();
  });
});

// In the app the Reader only opens once the library has loaded an active document.
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}
async function renderReader(
  flows: Partial<Record<FlowId, { status: string; at: number }>> = {},
  mode: "read" | "listen" = "listen",
) {
  // How the document was opened decides the Reader's controls: Listen has audio controls, Read doesn't.
  searchParams.current = { mode };
  await AsyncStorage.setItem(WALKTHROUGH_KEY, JSON.stringify({ version: 1, flows }));
  await renderWithProviders(<OpenedReader />, {
    walkthrough: "fresh",
    measureNode,
    documents: [
      testDocument("doc-book", "Field Guide", { plainText: "First passage here. Second passage there." }),
    ],
  });
  await settle();
  // The Reader is ready once its text has been laid out.
  await fireEvent(screen.getByTestId("reader-scroll"), "layout", {
    nativeEvent: { layout: { height: 600 } },
  });
  await fireEvent(screen.getByText("First passage here."), "layout", {
    nativeEvent: { layout: { y: 0, height: 40 } },
  });
  await act(async () => jest.advanceTimersByTime(50));
  await waitForWalkthrough();
}

describe("Reader walkthrough", () => {
  it("waits until a document is opened", async () => {
    await renderTab(<Home />);
    await press("Skip walkthrough");
    expect((await saved()).reader).toBeUndefined();
  });

  it("follows the real Reader: document, progress, Ask Votic, Play, More, tools, Close", async () => {
    await renderReader();
    const titles: string[] = [];
    titles.push(screen.getByRole("header").props.children);
    for (let step = 0; step < 4; step += 1) {
      if (titles.at(-1) === "Ask Votic")
        // The compact panel, not a separate chat screen.
        expect(
          screen.getByText(
            "Ask about what you're reading. Answers appear in a small panel, so your document stays in view.",
          ),
        ).toBeTruthy();
      await press("Next");
      titles.push(screen.getAllByRole("header").at(-1)!.props.children);
    }
    expect(titles).toEqual(["Your document", "Your progress", "Ask Votic", "Listen", "More controls"]);
    expect(measured).toEqual(
      expect.arrayContaining(["Ask Votic about this page", "Play", "Expand listening controls"]),
    );
    // Using More for real opens the extra controls and moves on to them.
    await press("Expand listening controls");
    await act(async () => jest.advanceTimersByTime(200));
    await waitForWalkthrough();
    expect(screen.getByText("Make it yours")).toBeTruthy();
    await press("Next");
    expect(screen.getByText("Done reading?")).toBeTruthy();
    expect(measured).toContain("Close reader");
    await press("Got it");
    expect((await saved()).reader?.status).toBe("completed");
  });

  it("matches Read mode, which has no Play button until listening is chosen", async () => {
    await renderReader({}, "read");
    const titles: string[] = [screen.getByRole("header").props.children];
    for (let step = 0; step < 3; step += 1) {
      await press("Next");
      titles.push(screen.getAllByRole("header").at(-1)!.props.children);
    }
    expect(titles).toEqual(["Your document", "Your progress", "Ask Votic", "More controls"]);
    expect(
      screen.getByText("Tap More for reading tools: text, color, listening, and bookmarks."),
    ).toBeTruthy();
    await press("Show reading tools");
    await act(async () => jest.advanceTimersByTime(200));
    await waitForWalkthrough();
    expect(
      screen.getByText(
        "Text and Color adjust size, font, spacing, and theme. Listen switches to listening, and Bookmark saves this passage to Notes.",
      ),
    ).toBeTruthy();
  });

  it("ends with a one-time 'You're all set' that doesn't stop later tips", async () => {
    await renderReader({ intro: { status: "completed", at: 1 } });
    for (let i = 0; i < 5; i += 1) await press("Next");
    expect(screen.getByText("Done reading?")).toBeTruthy();
    await press("Got it");
    expect(screen.queryByText("You're all set")).toBeNull();
    await act(async () => jest.advanceTimersByTime(ALL_SET_DELAY_MS));
    await waitForWalkthrough();
    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(
      screen.getByText(
        "You know the essentials. Keep exploring Votic, and we'll show you helpful tips when you need them.",
      ),
    ).toBeTruthy();
    await press("Got it");
    expect((await saved()).allSet?.status).toBe("completed");
    // Contextual tips still appear later.
    await press("Ask Votic about this page");
    await act(async () => jest.advanceTimersByTime(1000));
    await waitForWalkthrough();
    expect(screen.getByText("Ask about this document")).toBeTruthy();
  });

  it("doesn't say 'You're all set' when the Reader walkthrough is skipped", async () => {
    await renderReader({ intro: { status: "completed", at: 1 } });
    await press("Skip walkthrough");
    await act(async () => jest.advanceTimersByTime(ALL_SET_DELAY_MS));
    await waitForWalkthrough();
    expect(screen.queryByText("You're all set")).toBeNull();
    expect((await saved()).allSet).toBeUndefined();
  });

  it("skips the tools step when More wasn't opened", async () => {
    await renderReader();
    for (let i = 0; i < 5; i += 1) await press("Next");
    expect(screen.getByText("Done reading?")).toBeTruthy();
  });

  it("connects a saved passage to Notes the first time one is saved", async () => {
    await renderReader({ reader: { status: "completed", at: 1 } });
    expect(card()).toBeNull();
    await press("Save current passage");
    await press("Save passage");
    await waitForWalkthrough();
    expect(screen.getByText("Saved to Notes")).toBeTruthy();
    expect(measured).toContain("Edit saved passage");
  });

  it("coaches the compact Ask Votic panel the first time it opens", async () => {
    await renderReader({ reader: { status: "completed", at: 1 } });
    await press("Ask Votic about this page");
    await act(async () => jest.advanceTimersByTime(1000));
    await waitForWalkthrough();
    expect(screen.getByText("Ask about this document")).toBeTruthy();
    expect(screen.getByTestId("ask-votic-panel")).toBeTruthy();
  });
});

describe("Replay and accessibility", () => {
  it("replays one walkthrough from Settings without resetting the others", async () => {
    await AsyncStorage.setItem(
      WALKTHROUGH_KEY,
      JSON.stringify({
        version: 1,
        flows: { home: { status: "completed", at: 1 }, documents: { status: "skipped", at: 1 } },
      }),
    );
    await renderWithProviders(<LearnVoticSettings />, { walkthrough: "fresh" });
    await settle();
    await press("Replay the Documents walkthrough");
    expect(router.push).toHaveBeenCalledWith("/documents");
    expect(await saved()).toEqual({
      intro: expect.objectContaining({ status: "migrated" }),
      home: expect.objectContaining({ status: "completed" }),
    });
  });

  it("keeps controls reachable for screen reader users", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await renderTab(<Documents />, { documents: [testDocument("d1", "Biology")] });
    expect(screen.getByText("Add documents")).toBeTruthy();
    expect(screen.queryAllByTestId("walkthrough-dim", { includeHiddenElements: true })).toHaveLength(0);
    await press("Next");
    expect(
      screen.getByTestId("walkthrough-spotlight", { includeHiddenElements: true }).props.pointerEvents,
    ).toBe("none");
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip walkthrough" })).toBeTruthy();
  });
});

describe("Existing Votic users", () => {
  it("aren't shown walkthroughs for areas they already use", async () => {
    await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "existing");
    await AsyncStorage.removeItem(WALKTHROUGH_KEY);
    const documents = [testDocument("d1", "Biology", { progress: 0.5, lastOpenedAt: 3 })];
    await renderTab(<Home />, { documents });
    // renderTab starts "fresh", so this is the first launch with walkthroughs on an existing install.
    expect(card()).toBeNull();
    const flows = await saved();
    expect(Object.keys(flows).sort()).toEqual([
      "allSet",
      "documents",
      "home",
      "home.documentOptions",
      "intro",
      "reader",
    ]);
    expect(flows.notes).toBeUndefined();
    screen.unmount();
    await renderTab(<Notes />, { documents });
    expect(screen.getByText("Notes start in the Reader")).toBeTruthy();
  });
});
