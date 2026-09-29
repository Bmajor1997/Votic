import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, AlertButton } from "react-native";
import Notes from "../../app/(tabs)/notes";
import { renderWithProviders, testDocument } from "../renderWithProviders";

// Reader saves passages as "passage-<sentence>", so both documents have a passage-3.
const documents = [
  testDocument("doc-psy", "Psychology", {
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
  testDocument("doc-bio", "Biology", {
    savedPassages: [
      {
        id: "passage-3",
        sentenceIndex: 3,
        text: "Cells divide.",
        note: "Mitosis has phases.",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }),
];

describe("Notes", () => {
  it("groups notes and saved passages by document", async () => {
    await renderWithProviders(<Notes />, { documents });
    expect(screen.getByRole("button", { name: "Open Psychology notebook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Biology notebook" })).toBeTruthy();
    expect(screen.getByText("1 note · 1 passage")).toBeTruthy();
  });

  it("shows a written note and a saved passage differently", async () => {
    await renderWithProviders(<Notes />, { documents });
    await fireEvent.press(screen.getByText("Chunking helps memory."));
    expect(screen.getByText("YOUR NOTE")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close note" })[0]);
    await fireEvent.press(screen.getByText("A saved quote."));
    expect(screen.getByText("SAVED PASSAGE")).toBeTruthy();
  });

  it("adds a note to a saved passage", async () => {
    await renderWithProviders(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "More options for saved passage" }));
    expect(screen.getByText("Note options")).toBeTruthy();
    expect(screen.getByText("Open in Reader")).toBeTruthy();
    await fireEvent.press(screen.getByText("Add a note"));
    await fireEvent.changeText(screen.getByLabelText("Note text"), "Quote from chapter two.");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByText("Quote from chapter two.")).toBeTruthy();
    expect(screen.getByText("2 notes · 0 passages")).toBeTruthy();
  });

  it("asks before removing a note, then removes it", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithProviders(<Notes />, { documents });
    await fireEvent.press(screen.getAllByRole("button", { name: "More options for note" })[0]);
    await fireEvent.press(screen.getByText("Remove from Notes"));
    expect(alert).toHaveBeenCalledWith("Remove from Notes?", expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    expect(await screen.findByText("0 notes · 1 passage")).toBeTruthy();
    expect(screen.queryByText("Chunking helps memory.")).toBeNull();
  });

  it("selects a passage in one document without selecting the same passage id in another", async () => {
    await renderWithProviders(<Notes />, { documents });
    await fireEvent.press(screen.getByRole("button", { name: "Select notes" }));
    await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select note from Biology" })[0]);
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    expect(screen.getByText("1 selected")).toBeTruthy();
  });
});
