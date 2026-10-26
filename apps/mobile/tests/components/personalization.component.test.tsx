import {
  load_account_preferences,
  remove_account_preferences,
} from "../../src/onboarding/accountPreferences";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import Notes from "../../app/(tabs)/notes";
import Settings from "../../app/(tabs)/settings";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { AskVotic } from "../../app/assistant";
import { ask_votic } from "../../src/api/voticApi";
import { EMPTY_ANSWERS, PersonalizationAnswers } from "../../src/onboarding/onboardingModel";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ ask_votic: jest.fn() }));
const askVoticMock = jest.mocked(ask_votic);

const PURPOSE_KEY = "votic.mobile.purpose.v1";

/** Setup finished with these answers, for renderWithProviders. */
function answered(change: Partial<PersonalizationAnswers>) {
  return { accountSetup: { answers: { ...EMPTY_ANSWERS, ...change } } };
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
    await render_with_providers(<AskVotic />, answered({ goals: ["find-quickly", "understand-reading"] }));
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
    await render_with_providers(<AskVotic />);
    expect(suggestions()).toContain("Find action items");
  });

  it("prefer personalization answers over a legacy purpose", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "work");
    await render_with_providers(<AskVotic />, answered({ readingHelp: ["simpler-language"] }));
    expect(suggestions()[0]).toBe("Explain this section simply");
    expect(suggestions()).not.toContain("Find action items");
  });

  it("work with neither answers nor a purpose", async () => {
    await render_with_providers(<AskVotic />);
    expect(suggestions()).toEqual([
      "Summarize this document",
      "Explain this section",
      "Find key points",
      "Help with my notes",
      "Compare key ideas",
      "Find information",
    ]);
  });

  it("send the explanation style chosen in personalization with each question", async () => {
    askVoticMock.mockResolvedValue({ answer: "Short.", mode: "ai", sectionIndex: null, sectionTitle: null });
    await render_with_providers(<SettingsDetailScreen category="personalization" />, { reduceMotion: true });
    await fireEvent.press(screen.getByRole("button", { name: "Your answers" }));
    await fireEvent.press(screen.getByLabelText("Personal reading. Read and listen at your own pace"));
    for (let step = 0; step < 2; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await fireEvent.press(screen.getByLabelText("Quick. A sentence or two"));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await settle();
    screen.unmount();
    await render_with_providers(<AskVotic />, { reduceMotion: true, accountSetup: "none" });
    await fireEvent.changeText(screen.getByLabelText("Ask Votic a question"), "What is ATP?");
    await fireEvent.press(screen.getByRole("button", { name: "Send question" }));
    expect(askVoticMock).toHaveBeenLastCalledWith("What is ATP?", undefined, [], "quick");
  });
});

describe("Notes notebook actions", () => {
  const documents = [
    test_document("d1", "Biology", {
      savedPassages: [
        { id: "passage-0", sentenceIndex: 0, text: "Cells.", note: "Mitosis", createdAt: 1, updatedAt: 1 },
      ],
    }),
  ];
  async function open_notebook(setup: Parameters<typeof render_with_providers>[1] = {}) {
    await render_with_providers(<Notes />, { documents, ...setup });
    await fireEvent.press(screen.getByRole("button", { name: "Open Biology notebook" }));
    await fireEvent.press(screen.getByRole("button", { name: "Notebook tools" }));
  }

  it("follow the person's personalization answers", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "learning");
    await open_notebook(answered({ goals: ["explain-difficult"] }));
    // The answers replace the School purpose's "Quiz me".
    expect(screen.getByRole("button", { name: "Key points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain key ideas" })).toBeTruthy();
  });

  it("keep a legacy purpose working, and work without one", async () => {
    await AsyncStorage.setItem(PURPOSE_KEY, "research");
    await open_notebook();
    expect(screen.getByRole("button", { name: "Key findings" })).toBeTruthy();
    screen.unmount();
    // The purpose now belongs to the account, which took it over from the device on first load.
    await AsyncStorage.removeItem(PURPOSE_KEY);
    await remove_account_preferences("test-user");
    await open_notebook();
    expect(screen.getByRole("button", { name: "Key points" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Explain" })).toBeTruthy();
  });
});

describe("Settings", () => {
  it("edits personalization with the same four questions as setup, and saves it", async () => {
    await render_with_providers(<SettingsDetailScreen category="personalization" />, answered({}));
    await fireEvent.press(screen.getByRole("button", { name: "Your answers" }));
    expect(screen.getByLabelText("Step 1 of 4")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Research. Dig into papers and compare findings"));
    for (let step = 0; step < 3; step += 1)
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Find your listening rhythm.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await settle();
    expect(screen.queryByText("Find your listening rhythm.")).toBeNull();
    expect((await load_account_preferences("test-user"))?.purpose).toBe("research");
  });

  it("offers Learn Votic and Personalization separately, without the old app tour", async () => {
    await render_with_providers(<Settings />);
    expect(screen.queryByText("Replay app tour")).toBeNull();
    expect(screen.getByRole("button", { name: "Personalization" })).toBeTruthy();
    screen.unmount();
    // Learn Votic lives under Help.
    await render_with_providers(<SettingsDetailScreen category="help" />);
    expect(screen.getByText("LEARN VOTIC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replay the Home walkthrough" })).toBeTruthy();
  });
});

it("discards every personalization preview when editing is closed without Save", async () => {
  await render_with_providers(<SettingsDetailScreen category="personalization" />);
  const original = await load_account_preferences("test-user");
  await fireEvent.press(screen.getByRole("button", { name: "Your answers" }));
  await fireEvent.press(screen.getByLabelText("Research. Dig into papers and compare findings"));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(screen.getByLabelText("Larger text"));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(screen.getByLabelText("Detailed. The full picture, with context"));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(screen.getByLabelText("2.0× speed"));
  await fireEvent.press(screen.getByLabelText("No highlighting. Just listen"));
  for (let step = 0; step < 4; step += 1) await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await settle();
  expect(await load_account_preferences("test-user")).toEqual(original);
  expect(await AsyncStorage.getItem(PURPOSE_KEY)).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1"))!)).toMatchObject({
    textSize: "default",
  });
});
