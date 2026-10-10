import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { cleanLocalDocumentText } from "../../src/documents/importDocument";
import { GettingStartedCard } from "../../src/onboarding/GettingStartedCard";
import { ONBOARDING_KEY, parseOnboardingState } from "../../src/onboarding/OnboardingProvider";
import { VOTIC_GUIDE_SOURCE_NAME, VOTIC_GUIDE_TEXT } from "../../src/onboarding/voticGuide";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { renderWithProviders, testDocument } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

async function savedOnboarding() {
  return parseOnboardingState(await AsyncStorage.getItem(ONBOARDING_KEY));
}

function GuideProbe() {
  const { documents, activeDocument } = useDocumentLibrary();
  return (
    <>
      <Text testID="guide-probe">
        {documents
          .map(
            (document) =>
              `${document.sourceName}:${document.savedPassages?.map((passage) => passage.note).join(",") ?? ""}`,
          )
          .join("|")}
      </Text>
      <Text testID="active-guide">{activeDocument?.plainText ?? ""}</Text>
    </>
  );
}
function LibraryCount() {
  const { documents } = useDocumentLibrary();
  return <Text testID="library-count">{documents.map((document) => document.title).join("|")}</Text>;
}

describe("Getting started", () => {
  it("offers a first action and adds the Votic guide when chosen", async () => {
    await renderWithProviders(
      <>
        <GettingStartedCard />
        <LibraryCount />
      </>,
      { onboarding: { checklistDismissed: false } },
    );
    expect(screen.getByRole("header", { name: "Welcome, Sam" })).toBeTruthy();
    expect(screen.getByLabelText("Add a document, not done yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try the Votic guide" }));
    expect(screen.getByTestId("library-count").props.children).toBe("Votic guide — updated features");
    expect(screen.getByLabelText("Add a document, done")).toBeTruthy();
    // With a document in the library, the card switches from first actions to the remaining steps.
    expect(screen.queryByRole("button", { name: "Try the Votic guide" })).toBeNull();
    expect(screen.getByText("3 quick steps to get the most from Votic.")).toBeTruthy();
  });

  it("opens the updated walkthrough from Help and preserves the old guide and notes", async () => {
    const old = testDocument("old-guide", "Votic guide", {
      sourceName: "Votic guide.md",
      savedPassages: [
        { id: "saved", sentenceIndex: 0, text: "Old guide", note: "My note", createdAt: 1, updatedAt: 1 },
      ],
    });
    await renderWithProviders(
      <>
        <SettingsDetailScreen category="help" />
        <GuideProbe />
      </>,
      { documents: [old] },
    );
    await fireEvent.press(screen.getByRole("button", { name: "Votic walkthrough" }));
    expect(screen.getByTestId("guide-probe").props.children).toContain("Votic guide.md:My note");
    expect(screen.getByTestId("guide-probe").props.children).toContain(VOTIC_GUIDE_SOURCE_NAME);
    expect(screen.getByTestId("active-guide").props.children).toBe(cleanLocalDocumentText(VOTIC_GUIDE_TEXT));
  });
  it("reuses the current walkthrough instead of creating another copy", async () => {
    const current = testDocument("current-guide", "Votic guide — updated features", {
      sourceName: VOTIC_GUIDE_SOURCE_NAME,
      plainText: cleanLocalDocumentText(VOTIC_GUIDE_TEXT),
    });
    await renderWithProviders(
      <>
        <SettingsDetailScreen category="help" />
        <GuideProbe />
      </>,
      { documents: [current] },
    );
    await fireEvent.press(screen.getByRole("button", { name: "Votic walkthrough" }));
    expect(screen.getByTestId("guide-probe").props.children).toBe(`${VOTIC_GUIDE_SOURCE_NAME}:`);
    expect(screen.getByTestId("active-guide").props.children).toBe(current.plainText);
  });
  it("covers the new features and the account distinction", () => {
    for (const feature of [
      "microphone",
      "waveform",
      "transcribe",
      "Note Workspace",
      "Settings now opens with categories",
      "Sign Out",
      "Delete Account",
      "two confirmation",
      "App Store or Google Play",
      "Sepia",
    ])
      expect(VOTIC_GUIDE_TEXT).toContain(feature);
  });
  it("can be hidden", async () => {
    await renderWithProviders(<GettingStartedCard />, { onboarding: { checklistDismissed: false } });
    await fireEvent.press(screen.getByRole("button", { name: "Hide getting started" }));
    expect(screen.queryByRole("button", { name: "Hide getting started" })).toBeNull();
    await waitFor(async () => expect((await savedOnboarding())?.checklistDismissed).toBe(true));
  });
});
