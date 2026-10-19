import { it, expect } from "@jest/globals";
import { act, fireEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { useAccountData } from "../../src/storage/AccountDataProvider";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { create_library_backup, restore_library_backup } from "../../src/storage/libraryBackup";
import { render_with_providers, test_document } from "../renderWithProviders";

it("quiesces consumers, restores, then remounts them with the restored library", async () => {
  let run: Promise<unknown> | null = null;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  function Harness() {
    const account = useAccountData();
    const library = useDocumentLibrary();
    return (
      <>
        <Text>{library.documents.map((d) => d.title).join(",")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore"
          onPress={() => {
            run = account.runLibraryTask(async (uid) => {
              const backup = await create_library_backup(uid);
              await gate;
              await restore_library_backup(uid, {
                ...backup,
                id: "restore-fixture",
                documents: [test_document("restored", "Restored document")],
              });
            });
          }}
        >
          <Text>Restore</Text>
        </Pressable>
      </>
    );
  }
  const screen = await render_with_providers(<Harness />, {
    documents: [test_document("existing", "Existing work")],
  });
  await fireEvent.press(screen.getByLabelText("Restore"));
  expect(screen.queryByText("Existing work")).toBeNull();
  expect(screen.getByText(/Saving your library/)).toBeTruthy();
  await act(async () => {
    release();
    await run;
  });
  expect(screen.getByText("Existing work,Restored document")).toBeTruthy();
});
