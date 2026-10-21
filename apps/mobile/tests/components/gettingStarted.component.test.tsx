import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { clean_local_document_text } from "../../src/documents/importDocument";
import { VOTIC_GUIDE_SOURCE_NAME, VOTIC_GUIDE_TEXT } from "../../src/onboarding/voticGuide";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

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
describe("Votic guide in Help", () => {
  it("opens the updated walkthrough from Help and preserves the old guide and notes", async () => {
    const old = test_document("old-guide", "Votic guide", {
      sourceName: "Votic guide.md",
      savedPassages: [
        { id: "saved", sentenceIndex: 0, text: "Old guide", note: "My note", createdAt: 1, updatedAt: 1 },
      ],
    });
    await render_with_providers(
      <>
        <SettingsDetailScreen category="help" />
        <GuideProbe />
      </>,
      { documents: [old] },
    );
    await fireEvent.press(screen.getByRole("button", { name: "Votic walkthrough" }));
    expect(screen.getByTestId("guide-probe").props.children).toContain("Votic guide.md:My note");
    expect(screen.getByTestId("guide-probe").props.children).toContain(VOTIC_GUIDE_SOURCE_NAME);
    expect(screen.getByTestId("active-guide").props.children).toBe(
      clean_local_document_text(VOTIC_GUIDE_TEXT),
    );
  });
  it("reuses the current walkthrough instead of creating another copy", async () => {
    const current = test_document("current-guide", "Votic guide — updated features", {
      sourceName: VOTIC_GUIDE_SOURCE_NAME,
      plainText: clean_local_document_text(VOTIC_GUIDE_TEXT),
    });
    await render_with_providers(
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
});
