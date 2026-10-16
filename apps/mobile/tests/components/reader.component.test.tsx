import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Animated, BackHandler, Dimensions, Platform, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Reader from "../../app/reader";
import { ONBOARDING_KEY } from "../../src/onboarding/OnboardingProvider";
import { ask_votic } from "../../src/api/voticApi";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { router, searchParams } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));
const speak = jest.mocked(Speech.speak);
const askVoticMock = jest.mocked(ask_votic);

// In the app the Reader only opens once the library has loaded an active document.
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

const book = test_document("doc-book", "Field Guide", {
  plainText: "First passage here. Second passage there. Third passage ends.",
});

/** The options (callbacks) passed to the most recent Speech.speak call. */
function last_speech() {
  const call = speak.mock.calls.at(-1);
  if (!call) throw new Error("nothing was spoken");
  return { text: call[0], options: call[1] as Speech.SpeechOptions };
}

/** How far the Ask Votic panel is below its open position: 0 is fully open. */
function ask_panel_offset() {
  const style = StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style);
  const transform = (style.transform ?? []) as { translateY?: number }[];
  return transform.find((step) => step.translateY !== undefined)?.translateY ?? 0;
}
function ask_panel_height() {
  return StyleSheet.flatten(screen.getByTestId("ask-votic-panel").props.style).height as number;
}
function reader_dock_offset(includeHiddenElements = false) {
  const style = StyleSheet.flatten(
    screen.getByTestId("reader-dock-container", { includeHiddenElements }).props.style,
  );
  const transform = (style.transform ?? []) as { translateY?: number }[];
  return transform.find((step) => step.translateY !== undefined)?.translateY ?? 0;
}
function reader_dock_opacity(includeHiddenElements = false) {
  return StyleSheet.flatten(
    screen.getByTestId("reader-dock-container", { includeHiddenElements }).props.style,
  ).opacity as number;
}

async function expand_listening_controls() {
  await fireEvent.press(screen.getByRole("button", { name: "Expand listening controls" }));
}

beforeEach(() => {
  speak.mockReset();
  askVoticMock.mockReset();
  // These tests cover narration, so the Reader opens the way Listen does. Read mode has its own tests.
  searchParams.current = { mode: "listen" };
});

describe("Reader", () => {
  it("offers summaries and quick notes throughout the Reader conversation without moving the passage", async () => {
    askVoticMock.mockResolvedValueOnce({
      answer: "First answer.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: null,
    });
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    expect(screen.queryByRole("button", { name: "Quick notes" })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "My first question?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    let finish!: (value: Awaited<ReturnType<typeof ask_votic>>) => void;
    askVoticMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Summarize" }));
    const transcript = askVoticMock.mock.calls.at(-1)?.[1]?.sections[0].text;
    expect(transcript).toContain("You: My first question?");
    expect(transcript).toContain("Votic: First answer.");
    expect(transcript).not.toContain(book.plainText);
    expect(screen.getByLabelText("Summarizing")).toBeTruthy();
    await act(async () =>
      finish({
        answer: "The guide covers three passages.",
        mode: "document-ai",
        sectionIndex: 0,
        sectionTitle: null,
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Quick notes" }));
    expect(screen.getByLabelText("Note text")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Note text"), "My own quick note.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(askVoticMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("First passage here.")).toBeTruthy();
  });
  it("speaks continuous passages on Android and ignores callbacks from completed utterances", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    try {
      await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(last_speech().text).toBe("First passage here."));
      const first = last_speech();
      await act(async () => first.options.onStart?.());
      const boundary = first.options.onBoundary as (event: { charIndex: number }) => void;
      await act(async () => boundary({ charIndex: 6 }));
      expect(screen.getByText("passage").props.style.fontWeight).toBe("900");
      expect(speak).toHaveBeenCalledTimes(1);
      await act(async () => first.options.onDone?.());
      expect(last_speech().text).toBe("Second passage there.");
      await act(async () => boundary({ charIndex: 14 }));
      expect(screen.getByText("Second").props.style.fontWeight).toBe("900");
      await act(async () => first.options.onDone?.());
      expect(speak).toHaveBeenCalledTimes(2);
      await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalledTimes(3));
      expect(last_speech().text).toBe("Second passage there.");
    } finally {
      platform.restore();
    }
  });

  it("shows Catch me up as a Where you left off reminder, not as another summary", async () => {
    searchParams.current = {};
    askVoticMock.mockResolvedValueOnce({
      answer: "You were reading about the second passage.",
      mode: "document-ai",
      sectionIndex: null,
      sectionTitle: null,
    });
    const halfway = test_document("doc-half", "Field Guide", {
      plainText: "First passage here. Second passage there. Third passage ends.",
      progress: 0.4,
      sentenceIndex: 1,
    });
    await render_with_providers(<OpenedReader />, { documents: [halfway], reduceMotion: true });
    await fireEvent.press(screen.getByText("More"));
    await fireEvent.press(screen.getByRole("button", { name: "Catch up" }));
    expect(askVoticMock.mock.calls[0][0]).toMatch(/no bullet points/);
    expect(await screen.findByRole("header", { name: "Where you left off" })).toBeTruthy();
    expect(screen.getByText("40% through Field Guide")).toBeTruthy();
    expect(screen.getByText("You were reading about the second passage.")).toBeTruthy();
    expect(screen.queryByText("Conversation summary")).toBeNull();
  });

  it("shows the document's passages and reading progress", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    expect(screen.getByText("Field Guide")).toBeTruthy();
    expect(screen.getByText("First passage here.")).toBeTruthy();
    expect(screen.getByText("Third passage ends.")).toBeTruthy();
    expect(screen.getByText("0% read")).toBeTruthy();
    expect(screen.getByText("2 passages left")).toBeTruthy();
    expect(screen.getByText("Ask Votic")).toBeTruthy();
    expect(screen.getByText("More")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand listening controls" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("reads the current passage aloud and continues to the next", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(last_speech().text).toBe("First passage here.");
    expect(last_speech().options.rate).toBe(1);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    await act(async () => last_speech().options.onDone?.());
    expect(last_speech().text).toBe("Second passage there.");
    expect(screen.getByText("1 passage left")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(Speech.stop).toHaveBeenCalled();
  });

  describe("keeps the highlighted word with the voice", () => {
    const story = test_document("doc-story", "Story", {
      plainText:
        'The  quick brown fox,\njumps over the lazy dog! "Next," she said.\n\nA new   paragraph starts.',
    });
    /** Fires a native word boundary the way iOS and Android report it: an offset into the spoken text. */
    async function boundary(speech: ReturnType<typeof last_speech>, word: string) {
      const charIndex = speech.text.indexOf(word);
      if (charIndex < 0) throw new Error(`"${word}" is not in "${speech.text}"`);
      const onBoundary = speech.options.onBoundary as (event: {
        charIndex: number;
        charLength: number;
      }) => void;
      await act(async () => onBoundary({ charIndex, charLength: word.length }));
    }
    async function speak_word(word: string) {
      await boundary(last_speech(), word);
    }
    function highlighted(word: string) {
      return screen.getByText(word).props.style?.fontWeight === "900";
    }

    it("highlights each word the moment the voice reaches it, with no lag", async () => {
      await render_with_providers(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      expect(last_speech().text).toBe("The  quick brown fox,\njumps over the lazy dog!");
      // Boundaries arrive back to back, as a fast voice or high speed produces them.
      for (const word of ["quick", "brown", "fox,", "jumps", "over", "lazy", "dog!"]) {
        await speak_word(word);
        expect(highlighted(word)).toBe(true);
      }
      expect(highlighted("quick")).toBe(false);
    });

    it("resumes after pause from the highlighted word and keeps the mapping", async () => {
      await render_with_providers(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speak_word("jumps");
      await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
      expect(highlighted("jumps")).toBe(true);

      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(last_speech().text).toBe("jumps over the lazy dog!"));
      // Offsets now count from the resumed text, and must still land on the same on-screen word.
      await speak_word("lazy");
      expect(highlighted("lazy")).toBe(true);
      expect(highlighted("jumps")).toBe(false);
    });

    it("moves the highlight into the next passage and across paragraph breaks", async () => {
      await render_with_providers(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speak_word("dog!");
      await act(async () => last_speech().options.onDone?.());
      expect(last_speech().text).toBe('"Next," she said.');
      expect(highlighted('"Next,"')).toBe(true);
      await speak_word("said.");
      expect(highlighted("said.")).toBe(true);

      await act(async () => last_speech().options.onDone?.());
      expect(last_speech().text).toBe("A new   paragraph starts.");
      await speak_word("paragraph");
      expect(highlighted("paragraph")).toBe(true);
    });

    it("ignores boundaries from speech that was stopped", async () => {
      await render_with_providers(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speak_word("brown");
      const stale = last_speech();
      await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
      await boundary(stale, "lazy");
      expect(highlighted("brown")).toBe(true);
      expect(highlighted("lazy")).toBe(false);
    });
  });

  it("moves between passages and finishes the document", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await expand_listening_controls();
    expect(screen.getByRole("button", { name: "Previous passage", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("1 passage left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("0 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Previous passage" }));
    expect(screen.getByText("1 passage left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));

    await fireEvent.press(screen.getByRole("button", { name: "Finish document" }));
    expect(screen.getByText("Nicely done.")).toBeTruthy();
    expect(screen.getByText("100% read")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Review" }));
    expect(router.push).toHaveBeenCalledWith("/review");
  });

  it("keeps speaking from the selected passage when skipping during playback", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(last_speech().text).toBe("First passage here."));
    await expand_listening_controls();

    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    await waitFor(() => expect(last_speech().text).toBe("Second passage there."));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Previous passage" }));
    await waitFor(() => expect(last_speech().text).toBe("First passage here."));
  });

  it("restarts the active spoken word at a newly selected playback speed", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(last_speech().text).toBe("First passage here."));
    const boundary = last_speech().options.onBoundary as (event: {
      charIndex: number;
      charLength: number;
    }) => void;
    await act(async () => boundary({ charIndex: 6, charLength: 7 }));

    await expand_listening_controls();
    await fireEvent.press(screen.getByRole("button", { name: /^Playback speed/ }));
    await fireEvent.press(screen.getByRole("radio", { name: "1.5×" }));

    await waitFor(() => expect(last_speech().text).toBe("passage here."));
    expect(last_speech().options.rate).toBe(1.5);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("finishes the document when narration reaches the end", async () => {
    await render_with_providers(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 2 }],
      reduceMotion: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(last_speech().text).toBe("Third passage ends."));
    await act(async () => last_speech().options.onDone?.());
    expect(screen.getByText("Nicely done.")).toBeTruthy();
  });

  it("saves the current passage with a note", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Save current passage" }));
    expect(screen.getAllByText("First passage here.").length).toBeGreaterThan(1);
    await fireEvent.changeText(screen.getByLabelText("Note about saved passage"), "Key opening idea.");
    await fireEvent.press(screen.getByRole("radio", { name: "Key Point" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save passage" }));
    expect(screen.getByRole("button", { name: "Edit saved passage" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Edit saved passage" }));
    expect(screen.getByDisplayValue("Key opening idea.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Key Point", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Remove saved passage" }));
    expect(screen.getByRole("button", { name: "Save current passage" })).toBeTruthy();
  });

  it("opens the listening controls from the speed button", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await expand_listening_controls();
    await fireEvent.press(screen.getByRole("button", { name: /^Playback speed/ }));
    expect(screen.getByRole("header", { name: "Listen" })).toBeTruthy();
    expect(screen.getByText("Your device voice will be used.")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close reader controls" })[0]);
    expect(screen.queryByRole("header", { name: "Listen" })).toBeNull();
  });

  it("stops narration and navigates back when closed", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Close reader" }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("opens Ask Votic inside Reader and keeps the document as context", async () => {
    askVoticMock.mockResolvedValue({
      answer: "Focus improves when distractions are reduced.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));

    expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
    expect(screen.queryByText("This document only")).toBeNull();
    expect(reader_dock_offset(true)).toBeGreaterThan(0);
    expect(reader_dock_opacity(true)).toBe(0);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    const compactAskInput = screen.getByPlaceholderText("Ask a question…");
    // One line to start, growing a line at a time up to six; Return still sends.
    expect(compactAskInput.props.multiline).toBe(true);
    expect(compactAskInput.props.submitBehavior).toBe("submit");
    expect(compactAskInput.props.returnKeyType).toBe("send");
    expect(StyleSheet.flatten(compactAskInput.props.style)).toMatchObject({ minHeight: 46, maxHeight: 146 });

    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() =>
      expect(screen.getByText("Focus improves when distractions are reduced.")).toBeTruthy(),
    );
    expect(askVoticMock).toHaveBeenCalledWith(
      "Why does focus help?",
      expect.objectContaining({ title: "Field Guide" }),
      [],
      "adaptive",
    );
    // Each answer ends with its source passage and a bookmark; nothing about the whole conversation.
    expect(screen.getByRole("button", { name: "Open Field Guide at passage 1 in Reader" })).toBeTruthy();
    expect(screen.getByText("Passage 1 · Field Guide")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save conversation to Notes" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Save answer to Notes" }));
    expect(screen.getByRole("button", { name: "Saved to Notes" })).toBeTruthy();

    // All conversation-level actions live together in the header menu, even after one exchange.
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    expect(screen.getByRole("menuitem", { name: "Summarize" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Save conversation to Notes" }));
    expect(screen.queryByRole("menu")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    expect(screen.getByRole("menuitem", { name: "Conversation saved to Notes" })).toBeDisabled();
    await fireEvent.press(screen.getByLabelText("Close conversation options"));

    askVoticMock.mockResolvedValueOnce({
      answer: "Single-tasking keeps attention on one thing.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "And single-tasking?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() =>
      expect(screen.getByText("Single-tasking keeps attention on one thing.")).toBeTruthy(),
    );

    askVoticMock.mockResolvedValueOnce({
      answer: "• Reduce distractions\n• Give one task full attention\n• Key term: focus",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Summarize" }));
    await waitFor(() => expect(screen.getByLabelText("Conversation notes preview")).toBeTruthy());
    expect(screen.getByText(/Key term: focus/)).toBeTruthy();
    expect(screen.getByText("Conversation summary")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Save conversation summary to Notes" }));
    expect(screen.getByRole("button", { name: "Conversation summary saved to Notes" })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith("/assistant");

    // A later answer appears below the summary, where the conversation scrolls to, not hidden above it.
    askVoticMock.mockResolvedValueOnce({
      answer: "Breaks help attention recover.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "What about breaks?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(screen.getByText("Breaks help attention recover.")).toBeTruthy());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("Single-tasking keeps attention on one thing.")).toBeLessThan(
      tree.indexOf("Conversation summary"),
    );
    expect(tree.indexOf("Conversation summary")).toBeLessThan(tree.indexOf("Breaks help attention recover."));
  });

  it("sends a question once even when Return arrives twice before the screen updates", async () => {
    askVoticMock.mockResolvedValue({
      answer: "One answer.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: null,
    });
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    const input = screen.getByLabelText("Ask Votic a question");
    await act(async () => {
      input.props.onSubmitEditing();
      input.props.onSubmitEditing();
    });
    await waitFor(() => expect(screen.getByText("One answer.")).toBeTruthy());
    expect(askVoticMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Why does focus help?")).toHaveLength(1);
  });

  it("shows a limit notice as a notice, not as an answer from the document", async () => {
    const LIMIT = "Votic's AI features have reached today's limit. Please try again tomorrow.";
    askVoticMock.mockResolvedValue({
      answer: LIMIT,
      mode: "built-in",
      sectionIndex: null,
      sectionTitle: null,
    });
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(screen.getByText(LIMIT)).toBeTruthy());
    expect(screen.queryByText("· From this document")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save answer to Notes" })).toBeNull();
    expect(screen.getByRole("button", { name: "Conversation options" })).toBeTruthy();
    // A notice doesn't tick "Ask Votic a question" off the getting-started checklist.
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) ?? "{}").askedVotic).not.toBe(true);

    // The notice is not sent back as if it were an earlier answer.
    askVoticMock.mockResolvedValueOnce({
      answer: "Real answer.",
      mode: "document-ai",
      sectionIndex: null,
      sectionTitle: null,
    });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "And now?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(screen.getByText("Real answer.")).toBeTruthy());
    expect(askVoticMock).toHaveBeenLastCalledWith(
      "And now?",
      expect.anything(),
      [{ role: "user", text: "Why does focus help?" }],
      "adaptive",
    );
    await act(async () => {});
    expect(JSON.parse((await AsyncStorage.getItem(ONBOARDING_KEY)) ?? "{}").askedVotic).toBe(true);
  });

  it("summarizes the whole conversation, and shows a limit notice instead of a summary", async () => {
    await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    for (let turn = 1; turn <= 5; turn += 1) {
      askVoticMock.mockResolvedValueOnce({
        answer: `Answer ${turn}.`,
        mode: "document-ai",
        sectionIndex: null,
        sectionTitle: null,
      });
      await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), `Question ${turn}?`);
      await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
      await waitFor(() => expect(screen.getByText(`Answer ${turn}.`)).toBeTruthy());
    }
    const LIMIT = "You've reached today's limit for Votic's AI features. Please try again tomorrow.";
    askVoticMock.mockResolvedValueOnce({
      answer: LIMIT,
      mode: "built-in",
      sectionIndex: null,
      sectionTitle: null,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Summarize" }));
    await waitFor(() => expect(screen.getByText(LIMIT)).toBeTruthy());
    expect(screen.queryByLabelText("Conversation notes preview")).toBeNull();
    // All ten messages were sent, not just the last six.
    const transcript = askVoticMock.mock.calls.at(-1)?.[1]?.sections[0].text;
    for (let turn = 1; turn <= 5; turn += 1) {
      expect(transcript).toContain(`You: Question ${turn}?`);
      expect(transcript).toContain(`Votic: Answer ${turn}.`);
    }
  });

  it("closes Ask Votic at once with Reduce Motion and returns to the Reader where it was", async () => {
    askVoticMock.mockResolvedValue({
      answer: "Focus improves when distractions are reduced.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await render_with_providers(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 1 }],
      reduceMotion: true,
    });
    const readerPaddingBefore = StyleSheet.flatten(
      screen.getByTestId("reader-scroll").props.contentContainerStyle,
    ).paddingBottom;
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    // Opens straight into a dock-sized composer: the document's title, progress, and current passage
    // stay visible, and the listening dock is replaced rather than a large panel being added.
    expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
    expect(ask_panel_offset()).toBe(0);
    expect(ask_panel_height()).toBeLessThan(Dimensions.get("window").height * 0.2);
    expect(screen.getByText("Field Guide")).toBeTruthy();
    expect(screen.getByText("1 passage left")).toBeTruthy();
    expect(screen.getByText("Second passage there.")).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId("reader-scroll").props.contentContainerStyle).paddingBottom,
    ).toBe(readerPaddingBefore);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText("Focus improves when distractions are reduced.");
    // Answers get room, with a scrollable conversation, but never cover more than half the Reader.
    expect(ask_panel_height()).toBeGreaterThan(Dimensions.get("window").height * 0.3);
    expect(ask_panel_height()).toBeLessThanOrEqual(460);
    expect(ask_panel_height()).toBeLessThanOrEqual(Dimensions.get("window").height * 0.5);
    await fireEvent(screen.getByTestId("reader-available-space"), "layout", {
      nativeEvent: { layout: { height: 340 } },
    });
    expect(ask_panel_height()).toBe(170);
    expect(screen.getByText("Second passage there.")).toBeTruthy();
    speak.mockClear();

    await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
    expect(screen.queryByLabelText("Ask Votic conversation")).toBeNull();
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    // Reader controls and position are back, and closing does not start or change narration.
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(reader_dock_offset()).toBe(0);
    expect(reader_dock_opacity()).toBe(1);
    expect(screen.getByText("1 passage left")).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(last_speech().text).toBe("Second passage there."));
  });

  describe("opening and closing Ask Votic with animation", () => {
    const answer = "Focus improves when distractions are reduced.";
    // The test renderer has no native views, so run the Reader's native-driver animations on the JS driver.
    beforeEach(() => {
      const timing = Animated.timing;
      jest
        .spyOn(Animated, "timing")
        .mockImplementation((value, config) => timing(value, { ...config, useNativeDriver: false }));
    });
    /** Captures the Reader's Android Back handler (a real device calls it when Back is pressed). */
    function capture_back() {
      const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
      jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
        handlers.push(handler);
        return { remove: () => {} };
      });
      return () => handlers.at(-1)!({} as never);
    }
    /** Opens the Reader on passage 2 with motion on, and asks one question. */
    async function open_ask_with_answer() {
      askVoticMock.mockResolvedValue({
        answer,
        mode: "document-ai",
        sectionIndex: 0,
        sectionTitle: "Field Guide · 1/1",
      });
      await render_with_providers(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own opening transition
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
      await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
      await screen.findByText(answer);
      // The close control is in the panel's fixed header, so it stays available as the conversation grows.
      expect(screen.getByRole("button", { name: "Close Ask Votic" })).toBeTruthy();
      speak.mockClear();
      jest.mocked(Speech.stop).mockClear();
    }
    it.each(["finished", "shown all"])(
      "keeps %s answers visible when inserting a conversation summary",
      async (state) => {
        await open_ask_with_answer();
        if (state === "finished") await act(async () => jest.advanceTimersByTime(16000));
        else await fireEvent.press(screen.getByRole("button", { name: "Show full response" }));
        expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
        askVoticMock.mockResolvedValueOnce({
          answer: "A new conversation summary.",
          mode: "document-ai",
          sectionIndex: 0,
          sectionTitle: null,
        });
        await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
        await fireEvent.press(screen.getByRole("menuitem", { name: "Summarize" }));
        // Only the new summary is writing. Earlier answers keep their component state.
        expect(screen.getAllByRole("button", { name: "Show full response" })).toHaveLength(1);
        expect(screen.getByText(answer)).toBeTruthy();
        await act(async () => jest.advanceTimersByTime(16000));
        expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
      },
    );

    /** Ask Votic is fully closed and the Reader is back where it was, with nothing spoken or stopped. */
    function expect_reader_restored() {
      expect(screen.queryByLabelText("Ask Votic conversation")).toBeNull();
      expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
      expect(screen.queryByText(answer)).toBeNull();
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByText("1 passage left")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
      expect(speak).not.toHaveBeenCalled();
      expect(Speech.stop).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    }

    it("replaces the dock with a compact composer while the Reader stays in view", async () => {
      await render_with_providers(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own opening transition
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));

      // Mid-transition: the panel is on its way up.
      await act(async () => jest.advanceTimersByTime(150));
      expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
      expect(ask_panel_offset()).toBeGreaterThan(0);
      expect(ask_panel_offset()).toBeLessThan(ask_panel_height());
      expect(reader_dock_offset(true)).toBeGreaterThan(0);
      expect(reader_dock_opacity(true)).toBeLessThan(1);

      await act(async () => jest.advanceTimersByTime(400));
      expect(ask_panel_offset()).toBe(0);
      expect(reader_dock_offset(true)).toBeGreaterThan(0);
      expect(reader_dock_opacity(true)).toBe(0);
      expect(ask_panel_height()).toBeLessThan(Dimensions.get("window").height * 0.2);
      expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
      // The Reader is still there above the panel; only the listening dock is covered.
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByText("Second passage there.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
      expect(router.back).not.toHaveBeenCalled();
    });

    it("slides the panel back down as Ask Votic closes, the reverse of opening", async () => {
      await open_ask_with_answer();
      await act(async () => jest.advanceTimersByTime(400)); // opening settles
      expect(ask_panel_offset()).toBe(0);
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(150));
      expect(ask_panel_offset()).toBeGreaterThan(0);
      expect(ask_panel_offset()).toBeLessThan(ask_panel_height());
      expect(reader_dock_offset()).toBeGreaterThan(0);
      await act(async () => jest.advanceTimersByTime(400));
      expect_reader_restored();
    });

    it("turns back smoothly when closed while still opening", async () => {
      await render_with_providers(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300));
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      await act(async () => jest.advanceTimersByTime(120));
      const partway = ask_panel_offset();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(40));
      // It continues from where it was, heading back down, rather than jumping to either end.
      expect(ask_panel_offset()).toBeGreaterThan(partway);
      expect(ask_panel_offset()).toBeLessThan(ask_panel_height());
      speak.mockClear();
      jest.mocked(Speech.stop).mockClear();
      await act(async () => jest.advanceTimersByTime(550));
      expect_reader_restored();
    });

    it("animates closed from the X, keeping Ask Votic on screen until the transition ends", async () => {
      await open_ask_with_answer();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      // Mid-transition: the conversation is still there (sliding away) while the listening dock returns.
      await act(async () => jest.advanceTimersByTime(150));
      expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

      await act(async () => jest.advanceTimersByTime(400));
      expect_reader_restored();
    });

    it("closes Ask Votic on Android Back instead of the Reader, then Back leaves the Reader as usual", async () => {
      const pressBack = capture_back();
      await open_ask_with_answer();
      let handled: boolean | null | undefined;
      await act(async () => {
        handled = pressBack();
      });
      expect(handled).toBe(true);
      await act(async () => {
        pressBack(); // A second Back mid-transition must not close the Reader.
      });
      await act(async () => jest.advanceTimersByTime(550));
      expect_reader_restored();

      await act(async () => {
        pressBack();
      });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own closing transition
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(Speech.stop).toHaveBeenCalled();
    });

    it("keeps the conversation, and plays from the same passage, after closing", async () => {
      await open_ask_with_answer();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(550));
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(last_speech().text).toBe("Second passage there."));
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      expect(screen.getByText(answer)).toBeTruthy();
    });
  });

  it("moves the open Reader to the passage an Ask Votic answer links to", async () => {
    askVoticMock.mockResolvedValue({
      answer: "It starts with the first passage.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await render_with_providers(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 2 }],
      reduceMotion: true,
    });
    expect(screen.getByText("0 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Where does it start?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await fireEvent.press(await screen.findByRole("button", { name: /at passage 1 in Reader$/ }));
    expect(screen.queryByLabelText("Ask Votic conversation")).toBeNull();
    expect(screen.getByText("2 passages left")).toBeTruthy();
  });
});

it("reads an Ask answer and ignores late callbacks after the panel closes", async () => {
  askVoticMock.mockResolvedValueOnce({
    answer: "Focus supports learning.",
    mode: "document-ai",
    sectionIndex: null,
    sectionTitle: null,
  });
  await render_with_providers(<OpenedReader />, { documents: [book], reduceMotion: true });
  await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
  await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why focus?");
  await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
  const before = speak.mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "Read answer aloud" }));
  expect(speak.mock.calls.length).toBeGreaterThan(before);
  expect(last_speech().text).toBe("Focus supports learning.");
  const options = last_speech().options;
  await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
  const stopped = speak.mock.calls.length;
  await act(async () => options.onDone?.());
  expect(speak.mock.calls.length).toBe(stopped);
  expect(screen.queryByRole("button", { name: "Stop reading answer" })).toBeNull();
});
