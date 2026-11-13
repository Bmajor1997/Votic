import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { fakeSubscriptions, entitlement_of } from "../mocks/subscriptionService";
import { router } from "../mocks/expoRouter";
import { AppProviders, render_with_providers, test_document } from "../renderWithProviders";
import { FreeUpgradeSheet } from "../../src/subscription/FreeUpgradeSheet";
import * as subscriptions from "../../src/subscription/SubscriptionProvider";

it("waits for a plan check before showing the five-document upgrade", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("active") });
  const useSubscription = subscriptions.useSubscription;
  const subscription = jest.spyOn(subscriptions, "useSubscription").mockImplementation(() => ({
    ...useSubscription(),
    access: false,
    checking: true,
  }));
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? `Documents: ${library.documents.length}` : "Loading"}</Text>;
  }
  const rendered = await render_with_providers(<Probe />, {
    documents: Array.from({ length: 5 }, (_, n) => test_document(String(n), `Document ${n}`)),
  });
  await waitFor(() => expect(screen.getByText("Documents: 5")).toBeTruthy());
  await act(() => {
    expect(() => library.addTextDocument("Six.txt", "Example text")).toThrow(/checking your plan/i);
  });
  expect(screen.queryByText("Upgrade to Votic Plus to upload more files")).toBeNull();
  expect(screen.getByText("Documents: 5")).toBeTruthy();
  subscription.mockImplementation(useSubscription);
  await rendered.rerender(
    <AppProviders>
      <Probe />
    </AppProviders>,
  );
  await act(() => library.addTextDocument("Six.txt", "Example text"));
  expect(screen.getByText("Documents: 6")).toBeTruthy();
});

it("allows five new Free documents and rejects a sixth", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? `Documents: ${library.documents.length}` : "Loading"}</Text>;
  }
  await render_with_providers(<Probe />);
  await waitFor(() => expect(screen.getByText("Documents: 0")).toBeTruthy());
  await act(() => {
    for (let n = 0; n < 5; n++) library.addTextDocument(`Document ${n}.txt`, "Example text");
  });
  expect(screen.getByText("Documents: 5")).toBeTruthy();
  await act(() => {
    expect(() => library.addTextDocument("Six.txt", "Example text")).toThrow(/five saved documents/i);
  });
  expect(screen.getByText("Upgrade to Votic Plus to upload more files")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Subscribe to Votic Plus" }));
  expect(router.push).toHaveBeenCalledWith("/paywall");
  expect(screen.getByText("Documents: 5")).toBeTruthy();
});

it("keeps existing notes editable and blocks a 26th Free note", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return (
      <Text>
        {library.loaded
          ? `Notes: ${library.documents.flatMap((d) => d.savedPassages || []).length}`
          : "Loading"}
      </Text>
    );
  }
  await render_with_providers(<Probe />);
  await waitFor(() => expect(screen.getByText("Notes: 0")).toBeTruthy());
  const note = (id: string) => ({
    id,
    text: "",
    note: "A note",
    sentenceIndex: 0,
    createdAt: 1,
    updatedAt: 1,
  });
  await act(() => {
    for (let i = 0; i < 25; i++) expect(library.addQuickNote(note(String(i)))).toBe(true);
  });
  expect(screen.getByText("Notes: 25")).toBeTruthy();
  await act(() => {
    expect(library.addQuickNote({ ...note("0"), note: "Edited" })).toBe(true);
  });
  await act(() => {
    expect(library.addQuickNote(note("26"))).toBe(false);
  });
  expect(screen.getByRole("header", { name: "Keep more notes and bookmarks" })).toBeTruthy();
  expect(screen.getByText("Notes: 25")).toBeTruthy();
});

it("lets Plus save more than 25 notes", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("active") });
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? "Ready" : "Loading"}</Text>;
  }
  await render_with_providers(<Probe />);
  await waitFor(() => expect(screen.getByText("Ready")).toBeTruthy());
  await act(() => {
    for (let i = 0; i < 26; i++)
      expect(
        library.addQuickNote({
          id: String(i),
          text: "",
          note: "Note",
          sentenceIndex: 0,
          createdAt: 1,
          updatedAt: 1,
        }),
      ).toBe(true);
  });
  expect(screen.queryByRole("header", { name: "Keep more notes and bookmarks" })).toBeNull();
});

it("keeps existing notes after Plus ends and prevents new ones", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("active") });
  let library: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return (
      <Text>
        {library.loaded
          ? `Notes: ${library.documents.flatMap((d) => d.savedPassages || []).length}`
          : "Loading"}
      </Text>
    );
  }
  await render_with_providers(<Probe />);
  await waitFor(() => expect(screen.getByText("Notes: 0")).toBeTruthy());
  const note = (id: string) => ({
    id,
    text: "",
    note: "A note",
    sentenceIndex: 0,
    createdAt: 1,
    updatedAt: 1,
  });
  await act(() => {
    for (let i = 0; i < 26; i++) expect(library.addQuickNote(note(String(i)))).toBe(true);
  });
  await act(() => fakeSubscriptions.setEntitlement("test-user", entitlement_of("expired")));
  expect(screen.getByText("Notes: 26")).toBeTruthy();
  await act(() => {
    expect(library.addQuickNote(note("new"))).toBe(false);
  });
  expect(screen.getByText("Notes: 26")).toBeTruthy();
  await act(() => {
    expect(library.addQuickNote({ ...note("0"), note: "Edited" })).toBe(true);
  });
});

it("offers only Votic Plus at the Free scan limit, with no credits for sale", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  await render_with_providers(<FreeUpgradeSheet visible reason="scans" onClose={() => {}} />);
  expect(screen.getByText("Keep scanning")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Subscribe to Votic Plus" })).toBeTruthy();
  expect(screen.queryByText(/Buy credits/i)).toBeNull();
});

it("keeps a library larger than five usable after Plus ends and allows a new file once there is room", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("active") });
  let library!: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? "Ready" : "Loading"}</Text>;
  }
  await render_with_providers(<Probe />, {
    documents: Array.from({ length: 6 }, (_, n) => test_document(String(n), `Document ${n}`)),
  });
  await waitFor(() => expect(screen.getByText("Ready")).toBeTruthy());
  await act(() => fakeSubscriptions.setEntitlement("test-user", entitlement_of("expired")));
  expect(library.documents.filter((doc) => !doc.deletedAt)).toHaveLength(6);
  await act(() => {
    library.openDocument("5");
    library.renameDocument("5", "Still available on Free");
    library.updateProgress("5", 0.5, 1);
    expect(() => library.addTextDocument("New.txt", "New text")).toThrow(/five saved documents/i);
  });
  expect(library.activeDocument?.title).toBe("Still available on Free");
  expect(library.activeDocument?.progress).toBe(0.5);
  await act(() => {
    library.removeDocument("0");
    library.removeDocument("1");
  });
  await act(() => library.addTextDocument("New.txt", "New text"));
  expect(library.documents.filter((doc) => !doc.deletedAt)).toHaveLength(5);
});

it("counts quick notes and document bookmarks together and makes room when one is removed", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  let library!: ReturnType<typeof useDocumentLibrary>;
  function Probe() {
    library = useDocumentLibrary();
    return <Text>{library.loaded ? "Ready" : "Loading"}</Text>;
  }
  await render_with_providers(<Probe />, { documents: [test_document("book", "Book")] });
  await waitFor(() => expect(screen.getByText("Ready")).toBeTruthy());
  const note = (id: string) => ({
    id,
    text: "A passage",
    note: "A note",
    sentenceIndex: 0,
    createdAt: 1,
    updatedAt: 1,
  });
  await act(() => {
    for (let i = 0; i < 24; i++) expect(library.addQuickNote(note(`quick-${i}`))).toBe(true);
    expect(library.savePassage("book", note("bookmark"))).toBe(true);
  });
  await act(() => expect(library.addQuickNote(note("too-many"))).toBe(false));
  await act(() => library.removePassage("book", "bookmark"));
  await act(() => expect(library.addQuickNote(note("replacement"))).toBe(true));
  expect(
    library.documents.flatMap((doc) => doc.savedPassages ?? []).filter((saved) => !saved.deletedAt),
  ).toHaveLength(25);
});
