import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import Home from "../../app/(tabs)/index";
import Notes from "../../app/(tabs)/notes";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { SavedPassage } from "../../src/documents/types";
import { router, searchParams } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";
import { Text } from "react-native";

const note = (id: string, title: string, sentenceIndex: number, updatedAt: number): SavedPassage => ({
  id,
  sentenceIndex,
  title,
  text: "",
  note: `${title} body`,
  createdAt: updatedAt,
  updatedAt,
});
const quickNotes = test_document("quick", "Quick Notes", {
  notebookKind: "quick-notes",
  // Like the app's own Quick Notes notebook, whose text starts as its first note.
  plainText: "Groceries body",
  savedPassages: [note("q-groceries", "Groceries", 0, 30), note("q-call", "Call the dentist", 1, 20)],
});
const book = test_document("book", "Field Guide", {
  plainText: "First sentence. Second sentence. Third sentence.",
  savedPassages: [{ ...note("b-third", "Third idea", 2, 10), text: "Third sentence." }],
});

function ActiveProbe() {
  const { activeDocument } = useDocumentLibrary();
  return (
    <Text testID="active">
      {activeDocument ? `${activeDocument.id}@${activeDocument.sentenceIndex}` : "none"}
    </Text>
  );
}

describe("Home note links", () => {
  it("opens each Home note's own content: Quick Notes by note ID, document notes at their passage", async () => {
    await render_with_providers(
      <>
        <Home />
        <ActiveProbe />
      </>,
      { documents: [quickNotes, book] },
    );
    const card = (name: RegExp) => screen.getByRole("button", { name });
    const activeBefore = screen.getByTestId("active").props.children;

    expect(card(/^Groceries\./).props.accessibilityHint).toBe("Opens this note");
    await fireEvent.press(card(/^Groceries\./));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/notes",
      params: { note: "q-groceries", notebook: "quick" },
    });

    await fireEvent.press(card(/^Call the dentist\./));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/notes",
      params: { note: "q-call", notebook: "quick" },
    });
    // Opening a Quick Note never puts the whole notebook in the Reader.
    expect(router.push).not.toHaveBeenCalledWith("/reader");
    expect(screen.getByTestId("active").props.children).toBe(activeBefore);

    expect(card(/^Third idea\./).props.accessibilityHint).toBe("Opens the document at this passage");
    await fireEvent.press(card(/^Third idea\./));
    expect(router.push).toHaveBeenLastCalledWith("/reader");
    expect(screen.getByTestId("active").props.children).toBe("book@2");
  });

  it.each([
    ["q-groceries", "Groceries body", "Call the dentist body"],
    ["q-call", "Call the dentist body", "Groceries body"],
  ])("Notes opens just the %s note it was given", async (id, shown, hidden) => {
    searchParams.current = { note: id, notebook: "quick" };
    await render_with_providers(<Notes />, { documents: [quickNotes, book] });
    expect(await screen.findByText(shown)).toBeTruthy();
    expect(router.setParams).toHaveBeenCalledWith({ note: undefined, notebook: undefined });
    // The viewer shows one note; the other Quick Note isn't opened alongside it.
    expect(screen.queryAllByText(hidden).length).toBeLessThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Close note" })).toBeTruthy();
  });

  it("says a deleted note is no longer available instead of opening something else", async () => {
    searchParams.current = { note: "gone", notebook: "quick" };
    await render_with_providers(<Notes />, { documents: [quickNotes, book] });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That note is no longer available. It may have been deleted.",
    );
    expect(screen.queryByRole("button", { name: "Close note" })).toBeNull();
  });
});
