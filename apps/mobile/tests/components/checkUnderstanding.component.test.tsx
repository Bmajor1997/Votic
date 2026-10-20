import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import CheckUnderstandingScreen from "../../app/check-understanding";
import { render_with_providers, test_document } from "../renderWithProviders";

const PASSAGE =
  "Photosynthesis lets plants convert sunlight into chemical energy. Chlorophyll in the leaves absorbs light, and the plant uses that energy to turn water and carbon dioxide into glucose, releasing oxygen.";

async function answer_first_question(answer: string) {
  await render_with_providers(<CheckUnderstandingScreen />, {
    documents: [test_document("doc-photo", "Biology notes.pdf", { plainText: PASSAGE, progress: 1 })],
  });
  await fireEvent.changeText(screen.getByLabelText("Your answer to question 1"), answer);
  await fireEvent.press(screen.getByRole("button", { name: "Check answer to question 1" }));
}

describe("Check my understanding", () => {
  it("credits a correct answer worded differently from the passage", async () => {
    await answer_first_question(
      "Plants convert sunlight into chemical energy: chlorophyll absorbs the light and they turn water and carbon dioxide into glucose.",
    );
    expect(screen.getByRole("header", { name: "Matches the passage" })).toBeTruthy();
    expect(screen.queryByText(/start of it/)).toBeNull();
    expect(screen.getByText("Biology notes")).toBeTruthy();
  });

  it("stays strict about an answer that contradicts the passage", async () => {
    await answer_first_question(
      "Chlorophyll reflects light, so plants turn glucose into water and carbon dioxide.",
    );
    expect(screen.getByRole("header", { name: "Check one detail" })).toBeTruthy();
    expect(screen.getByText(/"reflect" where the passage says "absorb"/)).toBeTruthy();
  });
});
