import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Alert, AlertButton } from "react-native";
import { create_document_store } from "../../src/documents/documentStorage";
import Notes from "../../app/(tabs)/notes";
import { router } from "../mocks/expoRouter";
import { render_with_providers, test_document } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  maxSpeechInputLength: 4000,
}));

// Reader saves passages as "passage-<sentence>", so both documents have a passage-3.
const documents = [
  test_document("doc-psy", "Psychology", {
    savedPassages: [
      {
        id: "passage-3",
        sentenceIndex: 3,
        text: "Working memory is limited.",
        note: "Chunking helps memory.",
        createdAt: 1,
        updatedAt: 3,
      },
      { id: "passage-8", sentenceIndex: 8, text: "A saved quote.", note: "", createdAt: 1, updatedAt: 2 },
    ],
  }),
  test_document("doc-bio", "Biology", {
    savedPassages: [
      {
        id: "passage-3",
        sentenceIndex: 3,
        text: "Cells divide.",
        note: "Mitosis has phases.",
        noteType: "key-point",
        tags: ["cells"],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }),
];

describe("Notes", () => {
  it("groups notes and saved passages by document", async () => {
    await render_with_providers(<Notes />, { documents });
    expect(screen.getByRole("button", { name: "Open Psychology notebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Biology notebook" })).toBeTruthy();
    expect(screen.getByText("1 note · 1 passage")).toBeTruthy();
  });

  it("names each notebook by its document title and file, never a generic format label", async () => {
    const note = (id: string) => ({
      id,
      sentenceIndex: 0,
      text: "A passage.",
      note: "A note.",
      createdAt: 1,
      updatedAt: 1,
    });
    const library = [
      test_document("intro", "Introduction to Psychology", {
        sourceName: "Introduction to Psychology.pdf",
        savedPassages: [note("n1")],
      }),
      test_document("rome", "The History of Ancient Rome", {
        sourceName: "The History of Ancient Rome.epub",
        savedPassages: [note("n2")],
      }),
      // A renamed document: its title is shown, with the original file underneath.
      test_document("renamed", "Week 3 lecture", {
        sourceName: "lecture_03_final.docx",
        savedPassages: [note("n3")],
      }),
    ];
    await render_with_providers(<Notes />, { documents: library });
    for (const [title, file] of [
      ["Introduction to Psychology", "Introduction to Psychology.pdf"],
      ["The History of Ancient Rome", "The History of Ancient Rome.epub"],
      ["Week 3 lecture", "lecture_03_final.docx"],
    ]) {
      const card = screen.getByRole("button", { name: `Open ${title} notebook` });
      expect(card.props.accessibilityHint).toMatch(new RegExp(`^From ${file.replace(".", "\\.")}\\.`));
      expect(screen.getByText(file)).toBeTruthy();
    }
    expect(screen.queryByText("DOCUMENT")).toBeNull();
    expect(screen.queryByText(/^(PDF|EPUB) Document$/)).toBeNull();
  });

  it("shows a written note and a saved passage differently", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    await fireEvent.press(screen.getByText("Chunking helps memory."));
    expect(screen.getByText("YOUR NOTE")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close note" })[0]);
    await fireEvent.press(screen.getByText("A saved quote."));
    expect(screen.getByText("SAVED PASSAGE")).toBeTruthy();
  });

  it("adds a note to a saved passage", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    await fireEvent.press(screen.getByRole("button", { name: "More options for saved passage" }));
    expect(screen.getByText("Note options")).toBeTruthy();
    expect(screen.getByText("Open in Reader")).toBeTruthy();
    await fireEvent.press(screen.getByText("Add a note"));
    await fireEvent.changeText(screen.getByLabelText("Note text"), "Quote from chapter two.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByText("Quote from chapter two.")).toBeTruthy();
    expect(screen.getByText("2 notes · 0 saved passages")).toBeTruthy();
  });

  it("asks before removing a note, then removes it", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    await fireEvent.press(screen.getAllByRole("button", { name: "More options for note" })[0]);
    await fireEvent.press(screen.getByText("Remove from Notes"));
    expect(alert).toHaveBeenCalledWith("Remove from Notes?", expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    expect(await screen.findByText("0 notes · 1 saved passage")).toBeTruthy();
    expect(screen.queryByText("Chunking helps memory.")).toBeNull();
  });

  it("selects a passage in one document without selecting the same passage id in another", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Select notes" }));
    await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select note from Biology" })[0]);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    expect(screen.getByText("1 note selected")).toBeTruthy();
  });
});

describe("Notes search, filters, and notebooks", () => {
  it("searches notes, titles, and tags", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.changeText(screen.getByLabelText("Search notes"), "mitosis");
    expect(screen.getByRole("button", { name: "Open Biology notebook" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Psychology notebook" })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Search notes"), "no such words");
    expect(screen.getByText("No matches")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("button", { name: "Open Psychology notebook" })).toBeTruthy();
  });

  it("filters by type and tag from the filter sheet, and clears filters", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("header", { name: "Filter Notes" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Key Points" }));
    await fireEvent.press(screen.getByText("Show Results"));
    expect(screen.queryByRole("button", { name: "Open Psychology notebook" })).toBeNull();
    expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Remove Key Point filter" }));
    expect(screen.getByRole("button", { name: "Open Psychology notebook" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("button", { name: "#cells" }));
    await fireEvent.press(screen.getByText("Show Results"));
    expect(screen.queryByRole("button", { name: "Open Psychology notebook" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByRole("button", { name: "Open Psychology notebook" })).toBeTruthy();
  });

  it("opens a notebook with its counts and Ask Votic actions", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    expect(screen.getByText("1 note · 1 saved passage")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Biology notebook" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about Psychology notebook" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/assistant",
      params: { notesDocumentId: "doc-psy" },
    });
    expect(screen.queryByRole("button", { name: "Share notebook" })).toBeNull();
    expect(screen.queryByText("Definitions")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Psychology notebook" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Notebook tools" }));
    expect(screen.getByRole("button", { name: "Notebook tools", expanded: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share notebook" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Summarize notes" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/assistant",
      params: { notesDocumentId: "doc-psy", initialQuestion: "Summarize my notes from this document" },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Back to all notes" }));
    expect(screen.getByRole("button", { name: "Open Biology notebook" })).toBeTruthy();
  });

  it("pins a note", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    await fireEvent.press(screen.getByRole("button", { name: "More options for saved passage" }));
    await fireEvent.press(screen.getByText("Pin note"));
    expect(screen.getByText(/· Pinned$/)).toBeTruthy();
  });

  it("selects every note with Select all, and clears them with Deselect all", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Select notes" }));
    expect(screen.getByText("Choose notes to ask about, share, or delete")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete selected notes" }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Select all 3 notes" }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    expect(screen.getByText("3 notes selected")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Deselect all notes" }));
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
  });

  it("deletes only the chosen notes, after asking, and moves them to Recently Deleted", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Select notes" }));
    await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select note from Biology" })[0]);
    await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select note from Psychology" })[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Delete 2 notes" }));
    expect(alert).toHaveBeenCalledWith(
      "Remove 2 notes?",
      expect.stringContaining("Recently Deleted"),
      expect.any(Array),
    );
    // Cancel changes nothing.
    const first = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => first.find((button) => button.text === "Cancel")?.onPress?.());
    expect(screen.getByText("2 notes selected")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Delete 2 notes" }));
    const buttons = alert.mock.calls[1][2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    expect(screen.queryByText("Mitosis has phases.")).toBeNull();
    expect(screen.queryByText("Chunking helps memory.")).toBeNull();
    expect(await screen.findByText("1 saved passage in 1 notebook")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select notes" })).toBeTruthy();
  });

  it("asks Votic about selected notes by document and passage", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Select notes" }));
    await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select note from Biology" })[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about 1 note" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/assistant",
      params: {
        notesPassageIds: "doc-bio::passage-3",
        initialQuestion: "Help me understand these selected notes",
      },
    });
  });

  it("opens a note's passage in the Reader", async () => {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Biology notebook" }));
    await fireEvent.press(screen.getByText("Mitosis has phases."));
    await fireEvent.press(screen.getByRole("button", { name: "Open this passage in Reader" }));
    expect(router.push).toHaveBeenLastCalledWith("/reader");
  });
});

describe("Quick Notes", () => {
  it("hides Quick Note until a document has been added and directs readers to a document", async () => {
    await render_with_providers(<Notes />, { documents: [] });
    expect(screen.queryByRole("button", { name: "Quick Note" })).toBeNull();
    expect(screen.getByRole("header", { name: "Your notes will appear here" })).toBeTruthy();
    expect(screen.getByText("Save a passage while reading. Your notes will appear here.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open a document" }));
    expect(router.push).toHaveBeenCalledWith("/documents");
  });
  it("offers Quick Note as soon as a document exists, even before any notes", async () => {
    await render_with_providers(<Notes />, { documents: [test_document("empty-doc", "My Document")] });
    expect(screen.getByRole("button", { name: "Quick Note" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open My Document notebook" }));
    expect(screen.getByRole("header", { name: "Your notes will appear here" })).toBeTruthy();
  });
  it("creates standalone Quick Notes once notes exist and keeps them in one notebook", async () => {
    await render_with_providers(<Notes />, { documents: [documents[0]] });
    await fireEvent.press(screen.getByRole("button", { name: "Quick Note" }));
    expect(screen.getByRole("button", { name: "Save note", disabled: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Note text"), "Remember the meeting questions.");
    await fireEvent.press(screen.getByRole("button", { name: "Note details" }));
    await fireEvent.changeText(screen.getByLabelText("Note tags"), "work, meeting");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("button", { name: "Open Quick Notes notebook" })).toBeTruthy();
    expect(screen.queryByText("Remember the meeting questions.")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open Quick Notes notebook" }));
    expect(screen.getByRole("button", { name: "Ask Votic about Quick Notes notebook" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Quick Note" }));
    await fireEvent.changeText(screen.getByLabelText("Note text"), "A second independent thought.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByText("A second independent thought.")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    const saved = await create_document_store("test-user").loadDocuments();
    const quick = saved.find((document) => document.notebookKind === "quick-notes");
    expect(quick?.savedPassages).toHaveLength(2);
    expect(quick?.plainText).toContain("A second independent thought.");
    expect(screen.getByText("Remember the meeting questions.")).toBeTruthy();
  });
  it("adds a note to an empty notebook when notes already exist elsewhere", async () => {
    await render_with_providers(<Notes />, {
      documents: [test_document("empty-doc", "My Document"), documents[0]],
    });
    await fireEvent.press(screen.getByRole("button", { name: "Open My Document notebook" }));
    await fireEvent.press(screen.getByRole("button", { name: "Quick Note" }));
    await fireEvent.changeText(screen.getByLabelText("Note text"), "My own observation.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByText("My own observation.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask Votic about My Document notebook" })).toBeTruthy();
  });
});

describe("Note Workspace", () => {
  async function open_note() {
    await render_with_providers(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Open Psychology notebook" }));
    await fireEvent.press(screen.getByText("Chunking helps memory."));
  }
  it("asks about only the opened note and scopes each smart prompt", async () => {
    await open_note();
    expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Summarize" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Note smart actions" }));
    await fireEvent.press(screen.getByRole("button", { name: "Explain Simply" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/assistant",
      params: {
        notesDocumentId: "doc-psy",
        notesPassageId: "passage-3",
        initialQuestion: "Explain this note more simply, using only this note and its saved source passage.",
      },
    });
  });
  it.each(["Summarize", "Key Points", "Check My Understanding", "Create Questions", "Clean Up Note"])(
    "scopes %s to this note",
    async (label) => {
      await open_note();
      await fireEvent.press(screen.getByRole("button", { name: "Note smart actions" }));
      await fireEvent.press(screen.getByRole("button", { name: label }));
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: "/assistant",
        params: {
          notesDocumentId: "doc-psy",
          notesPassageId: "passage-3",
          initialQuestion: expect.any(String),
        },
      });
    },
  );
  it("edits in place and reopens the workspace with saved content", async () => {
    await open_note();
    await fireEvent.press(screen.getByRole("button", { name: "Edit this note" }));
    await fireEvent.changeText(screen.getByLabelText("Note text"), "An updated thought.");
    await fireEvent.changeText(screen.getByLabelText("Note title"), "Memory tools");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("header", { name: "Memory tools" })).toBeTruthy();
    expect(screen.getAllByText("An updated thought.").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole("button", { name: "Ask Votic about this note" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/assistant",
      params: { notesDocumentId: "doc-psy", notesPassageId: "passage-3" },
    });
  });
  it("reads the note rather than the source and stops audio on close", async () => {
    await open_note();
    const before = (Speech.speak as jest.Mock).mock.calls.length;
    await fireEvent.press(screen.getByRole("button", { name: "Listen" }));
    await act(async () => {});
    expect((Speech.speak as jest.Mock).mock.calls.slice(before)[0]).toEqual([
      "Chunking helps memory.",
      expect.objectContaining({ rate: 1, voice: undefined }),
    ]);
    const stops = (Speech.stop as jest.Mock).mock.calls.length;
    await fireEvent.press(screen.getByRole("button", { name: "Close note" }));
    expect((Speech.stop as jest.Mock).mock.calls.length).toBeGreaterThan(stops);
  });
  it("ignores late speech completion after closing the workspace", async () => {
    await open_note();
    await fireEvent.press(screen.getByRole("button", { name: "Listen" }));
    await act(async () => {});
    const calls = (Speech.speak as jest.Mock).mock.calls;
    const options = calls[calls.length - 1][1] as Speech.SpeechOptions;
    await fireEvent.press(screen.getByRole("button", { name: "Close note" }));
    const count = calls.length;
    await act(async () => {
      options.onDone?.();
    });
    expect((Speech.speak as jest.Mock).mock.calls).toHaveLength(count);
  });
  it("reports native speech failures and lets the user retry", async () => {
    await open_note();
    await fireEvent.press(screen.getByRole("button", { name: "Listen" }));
    await act(async () => {});
    const calls = (Speech.speak as jest.Mock).mock.calls;
    const options = calls[calls.length - 1][1] as Speech.SpeechOptions;
    await act(async () => {
      options.onError?.(new Error("Device voice failed"));
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
  });
  it("keeps standalone notes independent of Reader source links", async () => {
    await render_with_providers(<Notes />, {
      documents: [
        test_document("quick", "Quick Notes", {
          notebookKind: "quick-notes",
          savedPassages: [
            { id: "q", sentenceIndex: 0, text: "", note: "Standalone idea.", createdAt: 1, updatedAt: 1 },
          ],
        }),
      ],
    });
    await fireEvent.press(screen.getByRole("button", { name: "Open Quick Notes notebook" }));
    await fireEvent.press(screen.getByText("Standalone idea."));
    expect(screen.queryByRole("button", { name: "Open this passage in Reader" })).toBeNull();
    expect(screen.getByRole("button", { name: "Listen" })).toBeTruthy();
  });
});

it("previews real notebook contents and identifies their note type", async () => {
  await render_with_providers(<Notes />, { documents });
  expect(screen.getAllByTestId("note-content-preview", { includeHiddenElements: true })).toHaveLength(2);
  expect(screen.getByText("Mitosis has phases.", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText("KEY POINT", { includeHiddenElements: true })).toBeTruthy();
});
