import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import CheckUnderstandingScreen from "../../app/check-understanding";
import { check_understanding, UnderstandingVerdict } from "../../src/api/voticApi";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ check_understanding: jest.fn() }));
const checkMock = jest.mocked(check_understanding);
beforeEach(() => {
  checkMock.mockReset();
});

const PASSAGE =
  "Photosynthesis lets plants convert sunlight into chemical energy. Chlorophyll in the leaves absorbs light, and the plant uses that energy to turn water and carbon dioxide into glucose, releasing oxygen.";

async function open() {
  await render_with_providers(<CheckUnderstandingScreen />, {
    documents: [test_document("doc-photo", "Biology notes.pdf", { plainText: PASSAGE, progress: 1 })],
  });
}
async function answer(number: number, text: string) {
  await fireEvent.changeText(screen.getByLabelText(`Your answer to question ${number}`), text);
  await fireEvent.press(screen.getByRole("button", { name: `Check answer to question ${number}` }));
}

describe("Check my understanding", () => {
  it("sends each answer with its own question kind and the passage read so far", async () => {
    checkMock.mockResolvedValue({ verdict: "supported", feedback: "Right.", evidence: [], missing: null });
    await open();
    await answer(1, "Plants turn light into food.");
    await answer(2, "Chlorophyll absorbs the light.");
    expect(checkMock.mock.calls.map(([question, given]) => [question, given])).toEqual([
      ["main-point", "Plants turn light into food."],
      ["supporting-detail", "Chlorophyll absorbs the light."],
    ]);
    expect(checkMock.mock.calls[0][2]).toBe(PASSAGE);
    expect(
      screen.getByText(/sends it, with the part of the document you have read, to Votic's AI service/),
    ).toBeTruthy();
  });

  it.each<[UnderstandingVerdict, string]>([
    ["supported", "Your answer matches the passage"],
    ["partially_supported", "Partly right"],
    ["contradicted", "This conflicts with the passage"],
    ["unrelated", "This doesn't seem to be about this part"],
    ["insufficient", "Add a little more"],
  ])("names a %s verdict honestly and shows the passage evidence", async (verdict, title) => {
    checkMock.mockResolvedValueOnce({
      verdict,
      feedback: "Specific feedback from the check.",
      evidence:
        verdict === "unrelated" || verdict === "insufficient"
          ? []
          : ["Chlorophyll in the leaves absorbs light"],
      missing: verdict === "partially_supported" ? "What the energy is used for." : null,
    });
    await open();
    await answer(1, "An answer to grade.");
    expect(screen.getByRole("header", { name: title })).toBeTruthy();
    expect(screen.getByText("Specific feedback from the check.")).toBeTruthy();
    if (verdict === "partially_supported")
      expect(screen.getByText("Also worth including: What the energy is used for.")).toBeTruthy();
    expect(screen.queryAllByText(/From the passage:/)).toHaveLength(
      verdict === "unrelated" || verdict === "insufficient" ? 0 : 1,
    );
    // No generic reassurance is shown in place of a real evaluation.
    expect(screen.queryByText(/in your own words, you've got it/i)).toBeNull();
  });

  it("asks for an answer instead of checking an empty one", async () => {
    await open();
    await answer(1, "   ");
    expect(screen.getByRole("alert")).toHaveTextContent("Write an answer first, then check it.");
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("explains a failed check, keeps the answer, and retries the same answer", async () => {
    checkMock
      .mockRejectedValueOnce(
        new Error("Votic couldn't check this answer right now. Your answer is still here."),
      )
      .mockResolvedValueOnce({ verdict: "supported", feedback: "Right.", evidence: [], missing: null });
    await open();
    await answer(1, "Plants turn light into food.");
    expect(screen.getByRole("header", { name: "Couldn't check your answer" })).toBeTruthy();
    expect(screen.queryByRole("header", { name: "Your answer matches the passage" })).toBeNull();
    expect(screen.getByLabelText("Your answer to question 1")).toHaveDisplayValue(
      "Plants turn light into food.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(checkMock).toHaveBeenLastCalledWith(
      "main-point",
      "Plants turn light into food.",
      PASSAGE,
      expect.anything(),
    );
    expect(screen.getByRole("header", { name: "Your answer matches the passage" })).toBeTruthy();
  });
});
