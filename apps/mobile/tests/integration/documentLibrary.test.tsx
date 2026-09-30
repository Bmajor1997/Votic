import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { documentTextKey, LIBRARY_KEY } from "../../src/documents/documentStorage";
import { DocumentLibraryProvider, useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";

async function renderLibrary() {
  const hook = await renderHook(() => useDocumentLibrary(), { wrapper: DocumentLibraryProvider });
  await act(async () => {});
  return hook;
}

describe("document library persistence", () => {
  it("does not overwrite a library it could not read", async () => {
    await AsyncStorage.setItem(LIBRARY_KEY, "{not json");
    const { result } = await renderLibrary();
    expect(result.current.persistenceError).toMatch(/Your stored data has not been overwritten/);
    await act(async () => result.current.addTextDocument("new.txt", "New text."));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(await AsyncStorage.getItem(LIBRARY_KEY)).toBe("{not json");
  });

  it("shows an error when saving fails", async () => {
    const { result } = await renderLibrary();
    expect(result.current.persistenceError).toBeNull();
    // The AsyncStorage test mock is already a jest.fn, so fail only the next write instead of spying.
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));
    await act(async () => result.current.addTextDocument("new.txt", "New text."));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(result.current.persistenceError).toMatch(/could not save your library changes/);
  });

  it("saves changes after the throttle interval", async () => {
    const { result } = await renderLibrary();
    await act(async () => result.current.addTextDocument("new.txt", "New text."));
    expect(await AsyncStorage.getItem(LIBRARY_KEY)).toBeNull();
    // waitFor advances the fake timers until the throttled save has been written.
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]")).toHaveLength(1),
    );
  });

  it("clears a save error once a later save succeeds", async () => {
    const { result } = await renderLibrary();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));
    await act(async () => result.current.addTextDocument("new.txt", "New text."));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(result.current.persistenceError).toMatch(/could not save your library changes/);
    await act(async () => result.current.addTextDocument("second.txt", "Second text."));
    await act(async () => jest.advanceTimersByTime(1500));
    expect(result.current.persistenceError).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]")).toHaveLength(2);
  });

  it("opens the rest of the library when one document's text cannot be read", async () => {
    const stored = (id: string, title: string) => ({
      id,
      title,
      sourceName: id,
      importedAt: 1,
      updatedAt: 1,
      progress: 0,
      sentenceIndex: 0,
      wordIndex: 0,
      playbackRate: 1,
    });
    await AsyncStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify([stored("a", "Lost Book"), stored("b", "Kept Book")]),
    );
    await AsyncStorage.setItem(documentTextKey("b"), "Kept text.");
    const { result } = await renderLibrary();
    expect(result.current.documents.map((document) => document.title)).toEqual(["Kept Book"]);
    expect(result.current.persistenceError).toMatch(/“Lost Book” could not be opened/);
    // Library changes still save, and the unreadable document is kept.
    await act(async () => result.current.addTextDocument("new.txt", "New text."));
    await act(async () => jest.advanceTimersByTime(1500));
    const saved = JSON.parse((await AsyncStorage.getItem(LIBRARY_KEY)) || "[]");
    expect(saved.map((document: { title: string }) => document.title)).toEqual([
      "new",
      "Kept Book",
      "Lost Book",
    ]);
    expect(result.current.persistenceError).toMatch(/“Lost Book” could not be opened/);
  });
});
