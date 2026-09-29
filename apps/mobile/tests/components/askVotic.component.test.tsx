import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { AskVotic } from "../../app/assistant";
import { askVotic, VoticAnswer } from "../../src/api/voticApi";
import { renderWithProviders } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ askVotic: jest.fn() }));
const askVoticMock = jest.mocked(askVotic);
const CONNECTION_ERROR = "Votic could not connect. Check your connection and try again.";

async function ask(question: string) {
  await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), question);
  await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
}

describe("Ask Votic retry", () => {
  it("keeps a failed question and retries the same question", async () => {
    askVoticMock.mockRejectedValueOnce(new Error(CONNECTION_ERROR));
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await ask("What is ATP?");
    expect(await screen.findByText(CONNECTION_ERROR)).toBeTruthy();
    expect(screen.getByText("What is ATP?")).toBeTruthy();

    let answer!: (value: VoticAnswer) => void;
    askVoticMock.mockReturnValueOnce(new Promise<VoticAnswer>((resolve) => (answer = resolve)));
    await fireEvent.press(screen.getByRole("button", { name: "Retry question" }));

    // While the retry is in flight it says so, and can't be pressed again.
    expect(screen.getByText("Trying again…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry question", disabled: true })).toBeTruthy();
    expect(askVoticMock).toHaveBeenLastCalledWith("What is ATP?", undefined, []);

    await act(async () =>
      answer({ answer: "ATP stores energy.", mode: "ai", sectionIndex: null, sectionTitle: null }),
    );
    expect(screen.getByText("ATP stores energy.")).toBeTruthy();
    expect(screen.queryByText(CONNECTION_ERROR)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry question" })).toBeNull();
  });
});
