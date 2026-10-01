import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import Notes from "../../app/(tabs)/notes";
import Settings from "../../app/(tabs)/settings";
import { AskVotic } from "../../app/assistant";
import { askVotic } from "../../src/api/voticApi";
import {
  EMPTY_ANSWERS,
  newOnboardingState,
  PersonalizationAnswers,
} from "../../src/onboarding/onboardingModel";
import { loadOnboardingState, saveOnboardingState } from "../../src/onboarding/onboardingStorage";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ askVotic: jest.fn() }));
const askVoticMock = jest.mocked(askVotic);

// renderWithProviders signs in this account by default.
const UID = "user-1";
const PURPOSE_KEY = "votic.mobile.purpose.v1";

async function personalize(change: Partial<PersonalizationAnswers>) {
  await saveOnboardingState(UID, {
    ...newOnboardingState(),
    answers: { ...EMPTY_ANSWERS, ...change },
    personalizationCompletedAt: 1,
    completedAt: 1,
  });
}
/** Every suggestion Ask Votic can show, to read the chips on screen in order. */
const ALL_SUGGESTIONS = [
  "Summarize this document",
  "Explain this section",
  "Explain this section simply",
  "Find key points",
  "Help with my notes",
  "Ask about my notes",
  "Compare key ideas",
  "Compare key details",
  "Find information",
  "Quiz me on this document",
  "Help me understand this passage",
  "Find action items",
  "Highlight key decisions",
  "Identify key findings",
  "Explain the evidence",
  "What should I investigate next?",
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The suggestion chips on the Ask Votic screen, in order. */
function suggestions() {
  const pattern = new RegExp(`^(${ALL_SUGGESTIONS.map(escape).join("|")})$`);
  return screen.getAllByText(pattern).map((node) => String(node.props.children));
}
async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

describe("Ask Votic suggestions", () => {
  it("come from the person's personalization answers", async () => {
    await personalize({ goals: ["find-quickly", "understand-reading"] });
    await renderWithProviders(<AskVotic />);
    expect(suggestions()).toEqual([
      "Help me understand this passage",
      "Find information",
      "Summarize this document",
      "Explain this section",
      "Find key points",
      "Help with my notes",
    ]);
  });

  it("keep a legacy purpose working for people without answers", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "work");
    await renderWithProviders(<AskVotic />);
    expect(suggestions()).toContain("Find action items");
  });

  it("prefer personalization answers over a legacy purpose", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "work");
    await personalize({ readingHelp: ["simpler-language"] });
    await renderWithProviders(<AskVotic />);
    expect(suggestions()[0]).toBe("Explain this section simply");
    expect(suggestions()).not.toContain("Find action items");
  });

  it("work with neither answers nor a purpose", async () => {
    await renderWithProviders(<AskVotic />);
    expect(suggestions()).toEqual([
      "Summarize this document",
      "Explain this section",
      "Find key points",
      "Help with my notes",
      "Compare key ideas",
      "Find information",
    ]);
  });

  it("send the chosen explanation style with each question", async () => {
    askVoticMock.mockResolvedValue({ answer: "Short.", mode: "ai", sectionIndex: null, sectionTitle: null });
    await personalize({ explanationStyle: "quick", goals: ["summarize"] });
    await renderWithProviders(<AskVotic />, { reduceMotion: true });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "What is ATP?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(askVoticMock).toHaveBeenLastCalledWith("What is ATP?", undefined, [], "quick");
  });
});

describe("Notes notebook actions", () => {
  const documents = [
    testDocument("d1", "Biology", {
      savedPassages: [
        { id: "passage-0", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
      ],
    }),
  ];
  async function openNotebook() {
    await renderWithProviders(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Biology notebook" }));
  }

  it("follow the person's personalization answers", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "learning");
    await personalize({ goals: ["explain-difficult"] });
    await openNotebook();
    // The answers replace the School purpose's "Quiz me".
    expect(screen.getByRole("button", { name: "Key points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain key ideas" })).toBeTruthy();
  });

  it("keep a legacy purpose working, and work without one", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "research");
    await openNotebook();
    expect(screen.getByRole("button", { name: "Key findings" })).toBeTruthy();
    screen.unmount();
    await AsyncStorage.removeItem(PURPOSE_KEY);
    await openNotebook();
    expect(screen.getByRole("button", { name: "Key points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain" })).toBeTruthy();
  });
});

describe("Settings", () => {
  it("edits personalization, saves it, and updates Ask Votic's suggestions", async () => {
    await personalize({ goals: ["summarize"] });
    await renderWithProviders(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Personalization" }));
    await fireEvent.press(screen.getByLabelText("Find important information quickly"));
    for (let step = 0; step < 4; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: /Continue|Skip for now/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await settle();
    expect((await loadOnboardingState(UID))?.answers.goals).toEqual(["summarize", "find-quickly"]);
    screen.unmount();
    await renderWithProviders(<AskVotic />);
    expect(suggestions().slice(0, 2)).toEqual(["Summarize this document", "Find information"]);
  });

  it("offers Learn Votic and Personalization separately, without the old app tour", async () => {
    await renderWithProviders(<Settings />);
    expect(screen.queryByText("Replay app tour")).toBeNull();
    expect(screen.getByText("LEARN VOTIC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replay the Home walkthrough" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personalization" })).toBeTruthy();
  });
});
