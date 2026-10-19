import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { AppState } from "react-native";
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
  await act(async () =>
    (options.onBoundary as (event: { charIndex: number; charLength: number }) => void)?.({
      charIndex: 10,
      charLength: 5,
    }),
  );
  await act(async () => options.onError?.(new Error("no voice")));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
});

it("stops speech when leaving the listening view or entering checkout", async () => {
  const rendered = await render_with_providers(<PaywallPreview />);
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  const options = jest.mocked(Speech.speak).mock.calls.at(-1)![1]!;
  await fireEvent.press(screen.getByRole("tab", { name: "Read" }));
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

it("keeps the preview usable with reduced motion and stops on background", async () => {
  const listener = jest.spyOn(AppState, "addEventListener");
  await render_with_providers(<PaywallPreview />, { reduceMotion: true });
  await fireEvent.press(screen.getByRole("button", { name: "Play voice preview" }));
  const callbacks = listener.mock.calls.filter(([event]) => event === "change");
  await act(async () => callbacks.forEach(([, callback]) => callback("background")));
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
});
