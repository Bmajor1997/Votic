import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { fakeSubscriptions, entitlement_of } from "../mocks/subscriptionService";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";
import * as api from "../../src/api/voticApi";
import { FreeUpgradeSheet } from "../../src/subscription/FreeUpgradeSheet";

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
  // Files need Votic Plus: no credit packs are offered for them.
  expect(screen.queryByText("Just need a few more? Buy credits")).toBeNull();
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

it("offers Votic Plus first and credit packs as a smaller choice at the Free scan limit", async () => {
  fakeSubscriptions.reset({ defaultEntitlement: entitlement_of("none") });
  fakeSubscriptions.creditProducts = [
    { productId: "votic_ai_100", title: "100 AI credits", priceString: "$2.99" },
  ];
  jest.spyOn(api, "ai_usage").mockResolvedValue({
    status: "active",
    plan: { name: "Votic Free", free: true },
    monthly: null,
    purchased: null,
    purchaseProducts: ["votic_ai_100"],
  });
  await render_with_providers(<FreeUpgradeSheet visible reason="scans" onClose={() => {}} />);
  expect(screen.getByText("Keep scanning")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Subscribe to Votic Plus" })).toBeTruthy();
  expect(await screen.findByRole("header", { name: "Just need a few more? Buy credits" })).toBeTruthy();
  expect(screen.getByText(/Each extra page uses 3 credits/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "100 AI credits · $2.99" }));
  expect(fakeSubscriptions.calls).toContain("purchaseCredits:votic_ai_100");
});
