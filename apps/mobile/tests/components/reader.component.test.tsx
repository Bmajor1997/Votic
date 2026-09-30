import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Animated, BackHandler, StyleSheet } from "react-native";
import Reader from "../../app/reader";
import { askVotic } from "../../src/api/voticApi";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { router } from "../mocks/expoRouter";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("../../src/api/voticApi", () => ({ askVotic: jest.fn() }));
const speak = jest.mocked(Speech.speak);
const askVoticMock = jest.mocked(askVotic);

// In the app the Reader only opens once the library has loaded an active document.
function OpenedReader() {
  const { activeDocument } = useDocumentLibrary();
  return activeDocument ? <Reader /> : null;
}

const book = testDocument("doc-book", "Field Guide", {
  plainText: "First passage here. Second passage there. Third passage ends.",
});

/** The options (callbacks) passed to the most recent Speech.speak call. */
function lastSpeech() {
  const call = speak.mock.calls.at(-1);
  if (!call) throw new Error("nothing was spoken");
  return { text: call[0], options: call[1] as Speech.SpeechOptions };
}

/** How far the document has receded for Ask Votic: 1 is the full Reader. */
function documentScale() {
  const style = StyleSheet.flatten(screen.getByTestId("reader-document").props.style);
  const transform = (style.transform ?? []) as { scale?: number }[];
  return transform.find((step) => step.scale !== undefined)?.scale ?? 1;
}

async function expandListeningControls() {
  await fireEvent.press(screen.getByRole("button", { name: "Expand listening controls" }));
}

beforeEach(() => {
  speak.mockReset();
  askVoticMock.mockReset();
});

describe("Reader", () => {
  it("shows the document's passages and reading progress", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
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
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect(lastSpeech().text).toBe("First passage here.");
    expect(lastSpeech().options.rate).toBe(1);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    await act(async () => lastSpeech().options.onDone?.());
    expect(lastSpeech().text).toBe("Second passage there.");
    expect(screen.getByText("1 passages left")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(Speech.stop).toHaveBeenCalled();
  });

  describe("keeps the highlighted word with the voice", () => {
    const story = testDocument("doc-story", "Story", {
      plainText:
        'The  quick brown fox,\njumps over the lazy dog! "Next," she said.\n\nA new   paragraph starts.',
    });
    /** Fires a native word boundary the way iOS and Android report it: an offset into the spoken text. */
    async function boundary(speech: ReturnType<typeof lastSpeech>, word: string) {
      const charIndex = speech.text.indexOf(word);
      if (charIndex < 0) throw new Error(`"${word}" is not in "${speech.text}"`);
      const onBoundary = speech.options.onBoundary as (event: {
        charIndex: number;
        charLength: number;
      }) => void;
      await act(async () => onBoundary({ charIndex, charLength: word.length }));
    }
    async function speakWord(word: string) {
      await boundary(lastSpeech(), word);
    }
    function highlighted(word: string) {
      return screen.getByText(word).props.style?.fontWeight === "900";
    }

    it("highlights each word the moment the voice reaches it, with no lag", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      expect(lastSpeech().text).toBe("The  quick brown fox,\njumps over the lazy dog!");
      // Boundaries arrive back to back, as a fast voice or high speed produces them.
      for (const word of ["quick", "brown", "fox,", "jumps", "over", "lazy", "dog!"]) {
        await speakWord(word);
        expect(highlighted(word)).toBe(true);
      }
      expect(highlighted("quick")).toBe(false);
    });

    it("resumes after pause from the highlighted word and keeps the mapping", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speakWord("jumps");
      await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
      expect(highlighted("jumps")).toBe(true);

      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(lastSpeech().text).toBe("jumps over the lazy dog!"));
      // Offsets now count from the resumed text, and must still land on the same on-screen word.
      await speakWord("lazy");
      expect(highlighted("lazy")).toBe(true);
      expect(highlighted("jumps")).toBe(false);
    });

    it("moves the highlight into the next passage and across paragraph breaks", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speakWord("dog!");
      await act(async () => lastSpeech().options.onDone?.());
      expect(lastSpeech().text).toBe('"Next," she said.');
      expect(highlighted('"Next,"')).toBe(true);
      await speakWord("said.");
      expect(highlighted("said.")).toBe(true);

      await act(async () => lastSpeech().options.onDone?.());
      expect(lastSpeech().text).toBe("A new   paragraph starts.");
      await speakWord("paragraph");
      expect(highlighted("paragraph")).toBe(true);
    });

    it("ignores boundaries from speech that was stopped", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [story], reduceMotion: true });
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(speak).toHaveBeenCalled());
      await speakWord("brown");
      const stale = lastSpeech();
      await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
      await boundary(stale, "lazy");
      expect(highlighted("brown")).toBe(true);
      expect(highlighted("lazy")).toBe(false);
    });
  });

  it("moves between passages and finishes the document", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await expandListeningControls();
    expect(screen.getByRole("button", { name: "Previous passage", disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("1 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));
    expect(screen.getByText("0 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Previous passage" }));
    expect(screen.getByText("1 passages left")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next passage" }));

    await fireEvent.press(screen.getByRole("button", { name: "Finish document" }));
    expect(screen.getByText("Nicely done.")).toBeTruthy();
    expect(screen.getByText("100% read")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Review" }));
    expect(router.push).toHaveBeenCalledWith("/review");
  });

  it("finishes the document when narration reaches the end", async () => {
    await renderWithProviders(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 2 }],
      reduceMotion: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(lastSpeech().text).toBe("Third passage ends."));
    await act(async () => lastSpeech().options.onDone?.());
    expect(screen.getByText("Nicely done.")).toBeTruthy();
  });

  it("saves the current passage with a note", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
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
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await expandListeningControls();
    await fireEvent.press(screen.getByRole("button", { name: /^Playback speed/ }));
    expect(screen.getByRole("header", { name: "Listen" })).toBeTruthy();
    expect(screen.getByText("Your device voice will be used.")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close reader controls" })[0]);
    expect(screen.queryByRole("header", { name: "Listen" })).toBeNull();
  });

  it("stops narration and navigates back when closed", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
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
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));

    expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
    expect(screen.queryByText("This document only")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() =>
      expect(screen.getByText("Focus improves when distractions are reduced.")).toBeTruthy(),
    );
    expect(askVoticMock).toHaveBeenCalledWith(
      "Why does focus help?",
      expect.objectContaining({ title: "Field Guide" }),
      [],
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save answer to Notes" }));
    expect(screen.getByRole("button", { name: "Saved to Notes" })).toBeTruthy();

    askVoticMock.mockResolvedValueOnce({
      answer: "• Reduce distractions\n• Give one task full attention\n• Key term: focus",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await fireEvent.press(screen.getByRole("button", { name: "Summarize conversation into notes" }));
    await waitFor(() => expect(screen.getByLabelText("Conversation notes preview")).toBeTruthy());
    expect(screen.getByText(/Key term: focus/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Save conversation notes" }));
    expect(screen.getByRole("button", { name: "Conversation notes saved" })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith("/assistant");
  });

  it("shows a limit notice as a notice, not as an answer from the document", async () => {
    const LIMIT = "Votic's AI features have reached today's limit. Please try again tomorrow.";
    askVoticMock.mockResolvedValue({
      answer: LIMIT,
      mode: "built-in",
      sectionIndex: null,
      sectionTitle: null,
    });
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(screen.getByText(LIMIT)).toBeTruthy());
    expect(screen.queryByText("· From this document")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save answer to Notes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Summarize conversation into notes" })).toBeNull();

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
    expect(askVoticMock).toHaveBeenLastCalledWith("And now?", expect.anything(), [
      { role: "user", text: "Why does focus help?" },
    ]);
  });

  it("summarizes the whole conversation, and shows a limit notice instead of a summary", async () => {
    await renderWithProviders(<OpenedReader />, { documents: [book], reduceMotion: true });
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
    await fireEvent.press(screen.getByRole("button", { name: "Summarize conversation into notes" }));
    await waitFor(() => expect(screen.getByText(LIMIT)).toBeTruthy());
    expect(screen.queryByLabelText("Conversation notes preview")).toBeNull();
    // All ten messages were sent, not just the last six.
    const history = askVoticMock.mock.calls.at(-1)?.[2];
    expect(history).toHaveLength(10);
    expect(history?.[0]).toEqual({ role: "user", text: "Question 1?" });
  });

  it("closes Ask Votic at once with Reduce Motion and returns to the Reader where it was", async () => {
    askVoticMock.mockResolvedValue({
      answer: "Focus improves when distractions are reduced.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: "Field Guide · 1/1",
    });
    await renderWithProviders(<OpenedReader />, {
      documents: [{ ...book, sentenceIndex: 1 }],
      reduceMotion: true,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
    // Opens straight into Ask Votic: no transition, the Reader's header and dock already gone.
    expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
    expect(screen.queryByText("Field Guide")).toBeNull();
    expect(documentScale()).toBe(0.95);
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText("Focus improves when distractions are reduced.");
    speak.mockClear();

    await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
    expect(documentScale()).toBe(1);
    expect(screen.queryByLabelText("Ask Votic conversation")).toBeNull();
    expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
    // Reader controls and position are back, and closing does not start or change narration.
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("1 passages left")).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(lastSpeech().text).toBe("Second passage there."));
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
    function captureBack() {
      const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
      jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
        handlers.push(handler);
        return { remove: () => {} };
      });
      return () => handlers.at(-1)!({} as never);
    }
    /** Opens the Reader on passage 2 with motion on, and asks one question. */
    async function openAskWithAnswer() {
      askVoticMock.mockResolvedValue({
        answer,
        mode: "document-ai",
        sectionIndex: 0,
        sectionTitle: "Field Guide · 1/1",
      });
      await renderWithProviders(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own opening transition
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "Why does focus help?");
      await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
      await screen.findByText(answer);
      // The close control lives in the persistent Reader top bar, so it remains available after chat starts.
      expect(screen.getByRole("button", { name: "Close Ask Votic" })).toBeTruthy();
      speak.mockClear();
      jest.mocked(Speech.stop).mockClear();
    }
    /** Ask Votic is fully closed and the Reader is back where it was, with nothing spoken or stopped. */
    function expectReaderRestored() {
      expect(screen.queryByLabelText("Ask Votic conversation")).toBeNull();
      expect(screen.queryByLabelText("Ask Votic a question")).toBeNull();
      expect(screen.queryByText(answer)).toBeNull();
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByText("1 passages left")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
      expect(speak).not.toHaveBeenCalled();
      expect(Speech.stop).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
      expect(documentScale()).toBe(1);
    }

    it("opens by easing the Reader back while Ask Votic rises in, then settles", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own opening transition
      expect(documentScale()).toBe(1);
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));

      // Mid-transition: Ask Votic is already there, the header and dock are still fading, the document is receding.
      await act(async () => jest.advanceTimersByTime(150));
      expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
      expect(documentScale()).toBeLessThan(1);
      expect(documentScale()).toBeGreaterThan(0.95);

      await act(async () => jest.advanceTimersByTime(400));
      expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
      expect(screen.getByLabelText("Ask Votic a question")).toBeTruthy();
      expect(screen.queryByText("Field Guide")).toBeNull();
      expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
      expect(documentScale()).toBe(0.95);
      expect(router.back).not.toHaveBeenCalled();
    });

    it("scales the document back up as Ask Votic closes, the reverse of opening", async () => {
      await openAskWithAnswer();
      await act(async () => jest.advanceTimersByTime(400)); // opening settles
      expect(documentScale()).toBe(0.95);
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(150));
      expect(documentScale()).toBeGreaterThan(0.95);
      expect(documentScale()).toBeLessThan(1);
      await act(async () => jest.advanceTimersByTime(400));
      expectReaderRestored();
    });

    it("turns back smoothly when closed while still opening", async () => {
      await renderWithProviders(<OpenedReader />, { documents: [{ ...book, sentenceIndex: 1 }] });
      await act(async () => jest.advanceTimersByTime(300));
      await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this page" }));
      await act(async () => jest.advanceTimersByTime(120));
      const partway = documentScale();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(40));
      // It continues from where it was, heading back to the Reader, rather than jumping to either end.
      expect(documentScale()).toBeGreaterThan(partway);
      expect(documentScale()).toBeLessThan(1);
      speak.mockClear();
      jest.mocked(Speech.stop).mockClear();
      await act(async () => jest.advanceTimersByTime(550));
      expectReaderRestored();
    });

    it("animates closed from the X, keeping Ask Votic on screen until the transition ends", async () => {
      await openAskWithAnswer();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      // Mid-transition: the conversation is still there (fading away) while the Reader's header and dock return.
      await act(async () => jest.advanceTimersByTime(150));
      expect(screen.getByLabelText("Ask Votic conversation")).toBeTruthy();
      expect(screen.getByText("Field Guide")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

      await act(async () => jest.advanceTimersByTime(400));
      expectReaderRestored();
    });

    it("closes Ask Votic on Android Back instead of the Reader, then Back leaves the Reader as usual", async () => {
      const pressBack = captureBack();
      await openAskWithAnswer();
      let handled: boolean | null | undefined;
      await act(async () => {
        handled = pressBack();
      });
      expect(handled).toBe(true);
      await act(async () => {
        pressBack(); // A second Back mid-transition must not close the Reader.
      });
      await act(async () => jest.advanceTimersByTime(550));
      expectReaderRestored();

      await act(async () => {
        pressBack();
      });
      await act(async () => jest.advanceTimersByTime(300)); // the Reader's own closing transition
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(Speech.stop).toHaveBeenCalled();
    });

    it("keeps the conversation, and plays from the same passage, after closing", async () => {
      await openAskWithAnswer();
      await fireEvent.press(screen.getByRole("button", { name: "Close Ask Votic" }));
      await act(async () => jest.advanceTimersByTime(550));
      await fireEvent.press(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(lastSpeech().text).toBe("Second passage there."));
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
    await renderWithProviders(<OpenedReader />, {
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
