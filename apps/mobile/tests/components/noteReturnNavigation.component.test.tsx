import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { SavedPassage } from "../../src/documents/types";
import { AppProviders, seed_storage, test_document } from "../renderWithProviders";

// Real bottom tabs and history from expo-router, so "back" is the navigation people actually get.
jest.unmock("expo-router");
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderRouter } =
  require("expo-router/testing-library") as typeof import("expo-router/testing-library");
const { Tabs } = require("expo-router") as typeof import("expo-router");
const Home = require("../../app/(tabs)/index").default;
const Notes = require("../../app/(tabs)/notes").default;
/* eslint-enable @typescript-eslint/no-require-imports */

const note = (id: string, title: string, updatedAt: number): SavedPassage => ({
  id,
  sentenceIndex: 0,
  title,
  text: "",
  note: `${title} body`,
  createdAt: updatedAt,
  updatedAt,
});
const quickNotes = test_document("quick", "Quick Notes", {
  notebookKind: "quick-notes",
  plainText: "Groceries body",
  savedPassages: [note("q-groceries", "Groceries", 30), note("q-call", "Call the dentist", 20)],
});
const routes = {
  "(tabs)/_layout": () => <Tabs />,
  "(tabs)/index": Home,
  "(tabs)/notes": Notes,
};

async function open_app(initialUrl: string) {
  await seed_storage({ documents: [quickNotes] });
  let routed!: ReturnType<typeof renderRouter>;
  await act(async () => {
    routed = renderRouter(routes, { initialUrl, wrapper: AppProviders });
    await routed;
  });
  await act(async () => {});
  // Wrapped, because returning a promise-like object from an async function would unwrap it again.
  return { pathname: () => routed.getPathname() };
}
const close_note = () => act(async () => fireEvent.press(screen.getByRole("button", { name: "Close note" })));

describe("returning from a note", () => {
  it("a note opened from Home returns to Home", async () => {
    const app = await open_app("/");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: /^Groceries\./ })));
    expect(app.pathname()).toBe("/notes");
    expect(await screen.findByText("Groceries body")).toBeTruthy();
    await close_note();
    expect(app.pathname()).toBe("/");
    expect(screen.getByRole("button", { name: /^Call the dentist\./ })).toBeTruthy();
  });

  it("a note opened from Notes returns to Notes", async () => {
    const app = await open_app("/notes");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Open Quick Notes notebook" })));
    await act(async () =>
      fireEvent.press(screen.getAllByRole("button", { name: "View note from Quick Notes" })[0]),
    );
    expect(screen.getByRole("button", { name: "Close note" })).toBeTruthy();
    await close_note();
    expect(app.pathname()).toBe("/notes");
  });

  it("a direct link or cold start to a note closes into Notes", async () => {
    const app = await open_app("/notes?note=q-call&notebook=quick");
    expect(await screen.findByText("Call the dentist body")).toBeTruthy();
    await close_note();
    expect(app.pathname()).toBe("/notes");
  });

  it.each(["https://example.com", "/settings", "settings", "../reader"])(
    "an untrusted return value (%s) is ignored and the note closes into Notes",
    async (from) => {
      const app = await open_app(`/notes?note=q-call&notebook=quick&from=${encodeURIComponent(from)}`);
      await close_note();
      expect(app.pathname()).toBe("/notes");
    },
  );

  it("a deleted note from Home says so instead of opening something else", async () => {
    const app = await open_app("/notes?note=gone&notebook=quick&from=home");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That note is no longer available. It may have been deleted.",
    );
    expect(screen.queryByRole("button", { name: "Close note" })).toBeNull();
    expect(app.pathname()).toBe("/notes");
  });
});
