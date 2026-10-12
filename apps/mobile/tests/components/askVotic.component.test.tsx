import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Keyboard, StyleSheet } from "react-native";
import { AskVotic } from "../../app/assistant";
import { ask_votic, VoticAnswer } from "../../src/api/voticApi";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn(async () => {}) }));
const askVoticMock = jest.mocked(ask_votic);
const CONNECTION_ERROR = "Votic could not connect. Check your connection and try again.";

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
