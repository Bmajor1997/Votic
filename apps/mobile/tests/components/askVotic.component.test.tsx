import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Keyboard, StyleSheet, Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { AskVotic } from "../../app/assistant";
import { ask_votic, VoticAnswer } from "../../src/api/voticApi";
import { router } from "expo-router";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn(async () => {}) }));
const askVoticMock = jest.mocked(ask_votic);
const CONNECTION_ERROR = "Votic could not connect. Check your connection and try again.";
function QuickNotesProbe() {
  const { documents } = useDocumentLibrary();
  return (
    <Text testID="quick-notes-probe">
      {documents
        .find((document) => document.notebookKind === "quick-notes")
        ?.savedPassages?.map((passage) => passage.note)
        .join("\n") ?? ""}
    </Text>
  );
}

async function ask(question: string) {
  await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), question);
  await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
}

describe("Ask Votic retry", () => {
  it("keeps a failed question and retries the same question", async () => {
    askVoticMock.mockRejectedValueOnce(new Error(CONNECTION_ERROR));
    await render_with_providers(<AskVotic />, { reduceMotion: true });
    const dismissKeyboard = jest.spyOn(Keyboard, "dismiss");
    await ask("What is ATP?");
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(await screen.findByText(CONNECTION_ERROR)).toBeTruthy();
    expect(screen.getByText("What is ATP?")).toBeTruthy();

    let answer!: (value: VoticAnswer) => void;
    askVoticMock.mockReturnValueOnce(new Promise<VoticAnswer>((resolve) => (answer = resolve)));
    await fireEvent.press(screen.getByRole("button", { name: "Retry question" }));

    // While the retry is in flight it says so, and can't be pressed again.
    expect(screen.getByText("Trying again…")).toBeTruthy();
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry question", disabled: true })).toBeTruthy();
    expect(askVoticMock).toHaveBeenLastCalledWith("What is ATP?", undefined, [], "adaptive");

    await act(async () =>
      answer({ answer: "ATP stores energy.", mode: "ai", sectionIndex: null, sectionTitle: null }),
    );
    expect(screen.getByText("ATP stores energy.")).toBeTruthy();
    expect(screen.queryByText(CONNECTION_ERROR)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry question" })).toBeNull();
  });
});

describe("Ask Votic answers", () => {
  it("puts conversation summaries and the manual quick-note editor in the header menu", async () => {
    askVoticMock.mockClear();
    const book = test_document("quick-actions", "Field Guide", { plainText: "Focus matters. Rest helps." });
    askVoticMock.mockResolvedValue({
      answer: "Focus and rest help.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: null,
    });
    await render_with_providers(
      <>
        <AskVotic />
        <QuickNotesProbe />
      </>,
      { documents: [book], reduceMotion: true },
    );
    expect(screen.queryByRole("button", { name: "Summarize" })).toBeNull();
    await ask("Why does focus matter?");
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Summarize" }));
    expect(askVoticMock.mock.calls.at(-1)?.[1]?.sections[0].text).toBe(
      "You: Why does focus matter?\n\nVotic: Focus and rest help.",
    );
    expect(screen.getByText("Conversation summary")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Conversation options" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Quick notes" }));
    expect(screen.getByLabelText("Note text").props.value).toBe("");
    await fireEvent.changeText(screen.getByLabelText("Note text"), "My personal note.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.queryByLabelText("Note text")).toBeNull();
    expect(screen.getByTestId("quick-notes-probe").props.children).toBe("My personal note.");
    expect(askVoticMock).toHaveBeenCalledTimes(2);
  });
  it("does not offer to save a notice that replaced a document answer", async () => {
    const book = test_document("doc-book", "Field Guide", { plainText: "Focus matters. Rest helps." });
    await render_with_providers(<AskVotic />, { documents: [book], reduceMotion: true });
    askVoticMock.mockResolvedValueOnce({
      answer: "Real answer.",
      mode: "document-ai",
      sectionIndex: null,
      sectionTitle: null,
    });
    await ask("Why focus?");
    expect(await screen.findByText("Real answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save answer to Notes" })).toBeTruthy();

    const LIMIT = "Votic's AI features have reached today's limit. Please try again tomorrow.";
    askVoticMock.mockResolvedValueOnce({
      answer: LIMIT,
      mode: "built-in",
      sectionIndex: null,
      sectionTitle: null,
    });
    await ask("Why rest?");
    expect(await screen.findByText(LIMIT)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save answer to Notes" })).toHaveLength(1);
  });
});

describe("Ask Votic passage chip", () => {
  it("leads a document answer with the same passage chip as the Reader, not the old passage link", async () => {
    const guide = test_document("doc-guide", "Field_Guide.pdf", {
      sourceName: "Field_Guide.pdf",
      plainText:
        "Daily Habits\n\nSleep comes first for most people. Focus improves after a full night of rest.",
    });
    askVoticMock.mockResolvedValueOnce({
      answer: "Rest improves focus.",
      mode: "document-ai",
      sectionIndex: 0,
      sectionTitle: null,
      quote: "Focus improves after a full night of rest.",
    });
    await render_with_providers(<AskVotic />, { documents: [guide], reduceMotion: true });
    await ask("What improves focus?");
    expect(await screen.findByText("Rest improves focus.")).toBeTruthy();
    // The quoted sentence is passage 3; its part of the document is headed "Daily Habits".
    const chip = screen.getByRole("button", { name: "From passage 3, Daily Habits" });
    expect(chip.props.accessibilityHint).toBe("Opens this passage in the Reader");
    expect(screen.queryByRole("button", { name: /at passage \d+ in Reader/ })).toBeNull();
    expect(screen.queryByText(/^Passage \d+ ·/)).toBeNull();
    await fireEvent.press(chip);
    expect(router.push).toHaveBeenCalledWith("/reader");
  });
});

describe("Ask Votic question box", () => {
  it("starts at one line and allows up to six before scrolling", async () => {
    await render_with_providers(<AskVotic />);
    expect(StyleSheet.flatten(screen.getByLabelText("Ask Votic a question").props.style)).toMatchObject({
      minHeight: 48,
      maxHeight: 168,
    });
  });
});

it("offers opt-in read aloud below an Ask answer", async () => {
  jest.mocked(Speech.speak).mockClear();
  askVoticMock.mockResolvedValueOnce({
    answer: "ATP stores energy.",
    mode: "ai",
    sectionIndex: null,
    sectionTitle: null,
  });
  await render_with_providers(<AskVotic />, { reduceMotion: true });
  await ask("What is ATP?");
  expect(Speech.speak).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Read answer aloud" }));
  expect(Speech.speak).toHaveBeenCalledWith("ATP stores energy.", expect.anything());
  await fireEvent.press(screen.getByRole("button", { name: "Stop reading answer" }));
});

describe("Ask Votic about notes", () => {
  it("words its suggestions and introduction for notes, not 'this document'", async () => {
    const { searchParams } = jest.requireActual<typeof import("../mocks/expoRouter")>("../mocks/expoRouter");
    const withNote = test_document("doc-notes", "Biology", {
      savedPassages: [
        {
          id: "passage-0",
          sentenceIndex: 0,
          text: "Cells divide.",
          note: "Mitosis",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    searchParams.current = { notesDocumentId: "doc-notes" };
    await render_with_providers(<AskVotic />, { documents: [withNote], reduceMotion: true });
    expect(screen.getByText("Summarize these notes")).toBeTruthy();
    expect(screen.queryByText("Summarize this document")).toBeNull();
    expect(screen.getByText(/Ask about these notes/)).toBeTruthy();
  });
});
