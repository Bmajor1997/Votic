import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { BorderShimmer } from "../../src/components/BorderShimmer";
import { SendArrow } from "../../src/components/SendArrow";
import { render_with_providers } from "../renderWithProviders";

it("draws a light around the question box's outline, hidden from screen readers and still with Reduce Motion", async () => {
  await render_with_providers(<BorderShimmer radius={999} fill="#FFFFFF" />);
  const ring = screen.getByTestId("border-shimmer", { includeHiddenElements: true });
  expect(ring.props.pointerEvents).toBe("none");
  expect(ring.props.importantForAccessibility).toBe("no-hide-descendants");
  await screen.unmount();
  await render_with_providers(<BorderShimmer radius={999} fill="#FFFFFF" />, { reduceMotion: true });
  expect(screen.queryByTestId("border-shimmer", { includeHiddenElements: true })).toBeNull();
});

function SendHarness() {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SendArrow busy={busy} />
      <Pressable accessibilityRole="button" onPress={() => setBusy((value) => !value)}>
        <Text>Toggle</Text>
      </Pressable>
    </>
  );
}

it("keeps the arrow and the progress spinner in place, spinning only while a question is being answered", async () => {
  await render_with_providers(<SendHarness />);
  const spinner = () => screen.getByTestId("send-spinner");
  expect(screen.getByTestId("send-arrow")).toBeTruthy();
  expect(spinner().props.animating).toBe(false);
  await fireEvent.press(screen.getByText("Toggle"));
  await act(async () => jest.advanceTimersByTime(600));
  expect(spinner().props.animating).toBe(true);
  await fireEvent.press(screen.getByText("Toggle"));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(spinner().props.animating).toBe(false);
  expect(screen.getByTestId("send-arrow")).toBeTruthy();
});
