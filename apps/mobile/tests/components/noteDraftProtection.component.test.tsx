import { useState } from "react";
import { Alert, AlertButton, Pressable, Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { expect, it, jest } from "@jest/globals";
import { NoteEditor } from "../../src/notes/components/NoteEditor";
import { load_note_drafts } from "../../src/notes/draftStorage";
import { render_with_providers, test_document } from "../renderWithProviders";
const item = {
  document: test_document("book", "Book"),
  passage: { id: "note", sentenceIndex: 0, text: "Source", note: "Saved note", createdAt: 1, updatedAt: 1 },
};
const saved = jest.fn();
function Editor() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text>Open editor</Text>
      </Pressable>
      <NoteEditor
        item={open ? item : null}
        onClose={() => setOpen(false)}
        onSave={(_, draft) => {
          saved(draft);
          setOpen(false);
        }}
      />
    </>
  );
}
it("keeps an unsaved edit recoverable, restores its fields, and clears after explicit save", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await render_with_providers(<Editor />);
  await fireEvent.changeText(screen.getByLabelText("Note title"), "Draft title");
  await fireEvent.changeText(screen.getByLabelText("Note text"), "Unfinished edit");
  await fireEvent.press(screen.getByRole("button", { name: "Close note editor" }));
  expect(saved).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === "Keep draft")!.onPress!());
  expect((await load_note_drafts("test-user"))[0].draft).toMatchObject({
    title: "Draft title",
    note: "Unfinished edit",
  });
  await fireEvent.press(screen.getByRole("button", { name: "Open editor" }));
  expect(screen.getByLabelText("Note text").props.value).toBe("Unfinished edit");
  await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Draft title", note: "Unfinished edit" }),
  );
  expect(await load_note_drafts("test-user")).toEqual([]);
  alert.mockRestore();
});
