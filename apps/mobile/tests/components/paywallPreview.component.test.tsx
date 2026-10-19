import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { AppState, StyleSheet } from "react-native";
import { PaywallPreview } from "../../src/subscription/PaywallPreview";
import { PREVIEW_ANSWER, PREVIEW_TEXT } from "../../src/subscription/paywallPresentation";
import { AppProviders, render_with_providers } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => [
    { identifier: "english-a", name: "English A", language: "en-US" },
    { identifier: "english-b", name: "English B", language: "en-GB" },
  ]),
}));

const HIGHLIGHT = "#D9F985";
type Node = { type: unknown; props: { style?: unknown }; children: (Node | string)[] };
function text_of(node: Node | string): string {
  return typeof node === "string" ? node : node.children.map(text_of).join("");
}
/** The words currently shown with the reading highlight. */
function highlighted_words() {
  const found: string[] = [];
  const visit = (node: Node | string) => {
    if (typeof node === "string") return;
    const style = StyleSheet.flatten(node.props.style as never) as { backgroundColor?: string } | undefined;
    if (node.type === "Text" && style?.backgroundColor === HIGHLIGHT) found.push(text_of(node).trim());
    node.children.forEach(visit);
  };
  visit(screen.root as unknown as Node);
  return found;
}
async function play_and_get_options() {
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  return jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
}
/** The speech engine reports reaching "ideas" ("Big ideas start…": it begins at character 4). */
function word_boundary(options: Speech.SpeechOptions) {
  (options.onBoundary as ((event: { charIndex: number; charLength: number }) => void) | undefined)?.({
    charIndex: 4,
    charLength: 5,
  });
}

it("demonstrates all three modes without autoplaying audio or making an AI request", async () => {
  jest.mocked(Speech.speak).mockClear();
  await render_with_providers(<PaywallPreview />);
  expect(Speech.speak).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("tab", { name: "Understand" }));
  expect(screen.queryByText(PREVIEW_ANSWER)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Show example answer" }));
  expect(screen.getByText("EXAMPLE ANSWER")).toBeTruthy();
  expect(screen.getByText(PREVIEW_ANSWER)).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Read" }));
  expect(screen.getByLabelText(PREVIEW_TEXT)).toBeTruthy();
});

it("plays actual speech at the chosen speed, reports errors and lets people retry", async () => {
  await render_with_providers(<PaywallPreview />);
  await fireEvent.press(screen.getByRole("radio", { name: "Preview speed 1.5x" }));
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  expect(Speech.speak).toHaveBeenLastCalledWith(
    PREVIEW_TEXT,
    expect.objectContaining({ rate: 1.5, onBoundary: expect.any(Function) }),
  );
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  expect(highlighted_words()).toEqual([]);
  await act(async () => word_boundary(options));
  expect(highlighted_words()).toEqual(["ideas"]);
  await act(async () => options.onError?.(new Error("no voice")));
  expect(highlighted_words()).toEqual([]);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
});

it("stops speech when leaving the listening view or entering checkout", async () => {
  const rendered = await render_with_providers(<PaywallPreview />);
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  const before = jest.mocked(Speech.stop).mock.calls.length;
  await fireEvent.press(screen.getByRole("tab", { name: "Read" }));
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(before);
  // A late "done" from the stopped sample changes nothing.
  await act(async () => options.onDone?.());
  await fireEvent.press(screen.getByRole("tab", { name: "Listen" }));
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  const count = jest.mocked(Speech.stop).mock.calls.length;
  // Keep the real provider tree; rerendering a disabled preview must stop its external audio.
  await rendered.rerender(
    <AppProviders>
      <PaywallPreview disabled />
    </AppProviders>,
  );
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(count);
});

it("does not start queued speech after unmount", async () => {
  const rendered = await render_with_providers(<PaywallPreview />);
  jest.mocked(Speech.speak).mockClear();
  let release!: () => void;
  jest.mocked(Speech.stop).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  await rendered.unmount();
  await act(async () => release());
  expect(Speech.speak).not.toHaveBeenCalled();
});

it("plays with reduced motion but doesn't move the highlight from word to word", async () => {
  await render_with_providers(<PaywallPreview />, { reduceMotion: true });
  const options = await play_and_get_options();
  await act(async () => word_boundary(options));
  expect(highlighted_words()).toEqual([]);
  expect(screen.getByRole("button", { name: "Stop voice preview" })).toBeTruthy();
});

it("stops the audio itself when the app goes to the background", async () => {
  const listener = jest.spyOn(AppState, "addEventListener");
  await render_with_providers(<PaywallPreview />);
  await play_and_get_options();
  const before = jest.mocked(Speech.stop).mock.calls.length;
  const callbacks = listener.mock.calls.filter(([event]) => event === "change");
  await act(async () => callbacks.forEach(([, callback]) => callback("background")));
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(before);
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
});

it("stops a document reading in the background through its own player before speaking", async () => {
  await render_with_providers(<PaywallPreview />);
  const order: string[] = [];
  const player = {
    stop: jest.fn(async () => void order.push("reader")),
    start: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    get_state: () => ({}),
    addListener: () => ({ remove() {} }),
  };
  // Spy on the real module object; a namespace import is only a copy of it.
  const playback = jest.requireActual<typeof import("../../src/playback/notificationPlayback")>(
    "../../src/playback/notificationPlayback",
  );
  const spy = jest.spyOn(playback, "notification_player").mockReturnValue(player);
  jest.mocked(Speech.speak).mockImplementationOnce(() => void order.push("preview"));
  try {
    await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
    expect(order).toEqual(["reader", "preview"]);
  } finally {
    spy.mockRestore();
  }
});
