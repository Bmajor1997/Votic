import { expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Animated } from "react-native";
import Welcome from "../../app/welcome";
import { MOTION_SAMPLE, MotionShowcase } from "../../src/components/animations/MotionShowcase";
import { VoticPulse } from "../../src/components/animations/VoticPulse";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

function all_text(node: unknown): string {
  if (typeof node === "string") return node;
  const element = node as { children?: unknown[] } | null;
  return (element?.children ?? []).map(all_text).join(" ");
}

it("offers the motion lab on the welcome screen only in test builds", async () => {
  fakeAuth.reset(null);
  const rendered = await render_with_providers(<Welcome />);
  expect(screen.getByRole("button", { name: /Preview Votic animations/ })).toBeTruthy();
  await rendered.unmount();
  await render_with_providers(<Welcome motionLab={false} />);
  expect(screen.queryByRole("button", { name: /Preview Votic animations/ })).toBeNull();
  expect(screen.queryByText("Preview animations")).toBeNull();
});

it("spells Votic correctly everywhere and offers only real, labelled demos", async () => {
  await render_with_providers(<MotionShowcase visible onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "Votic motion lab" })).toBeTruthy();
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(4);
  for (const name of [/App introduction/, /Text-to-speech/, /Ask Votic/, /Votic Premium preview/]) {
    await fireEvent.press(screen.getByRole("radio", { name }));
    const text = all_text(screen.root);
    expect(text).toMatch(/Votic/);
    expect(text).not.toMatch(/vatic/i);
    expect(text).not.toMatch(/Plus|Pro\b/);
  }
});

it("plays and stops the speech sample, and stops speech when closed", async () => {
  const onClose = jest.fn();
  jest.mocked(Speech.speak).mockClear();
  await render_with_providers(<MotionShowcase visible onClose={onClose} />);
  await fireEvent.press(screen.getByRole("radio", { name: /Text-to-speech/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
  expect(jest.mocked(Speech.speak).mock.calls.at(-1)![0]).toBe(MOTION_SAMPLE);
  const stops = jest.mocked(Speech.stop).mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "Stop sample" }));
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(stops);
  await fireEvent.press(screen.getByRole("button", { name: "Play sample" }));
  const beforeClose = jest.mocked(Speech.stop).mock.calls.length;
  await fireEvent.press(screen.getByRole("button", { name: "Close animation preview" }));
  expect(jest.mocked(Speech.stop).mock.calls.length).toBeGreaterThan(beforeClose);
  expect(onClose).toHaveBeenCalled();
});

it("shows Ask Votic thinking, then a clearly labelled example answer, and the real paywall preview", async () => {
  await render_with_providers(<MotionShowcase visible onClose={() => {}} />);
  await fireEvent.press(screen.getByRole("radio", { name: /Ask Votic/ }));
  expect(screen.getByLabelText("Thinking")).toBeTruthy();
  expect(screen.getByTestId("ai-status-orb", { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Show example answer" }));
  expect(screen.getByText(/^Example answer:/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: /Votic Premium preview/ }));
  expect(screen.getByRole("tab", { name: "Listen" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play voice preview" })).toBeTruthy();
});

it("keeps the intro V still and says so when Less motion is on", async () => {
  await render_with_providers(<MotionShowcase visible onClose={() => {}} />, { reduceMotion: true });
  await fireEvent.press(screen.getByRole("button", { name: "Play intro" }));
  expect(screen.getByText("Less motion is on, so the V stays still.")).toBeTruthy();
});

it("hides the decorative pulse from screen readers and holds it still with Less motion", async () => {
  const loop = jest.spyOn(Animated, "loop");
  try {
    const rendered = await render_with_providers(<VoticPulse active />);
    const pulse = screen.getByTestId("votic-pulse", { includeHiddenElements: true });
    expect(pulse.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(pulse.props.accessibilityElementsHidden).toBe(true);
    expect(loop).toHaveBeenCalled();
    await rendered.unmount();
    loop.mockClear();
    await render_with_providers(<VoticPulse active />, { reduceMotion: true });
    expect(loop).not.toHaveBeenCalled();
  } finally {
    loop.mockRestore();
  }
});
