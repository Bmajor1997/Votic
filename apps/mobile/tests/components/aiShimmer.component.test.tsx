import { expect, it, jest } from "@jest/globals";
import { act, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { AIThinking, AIStatus } from "../../src/components/AIResponse";
import { render_with_providers } from "../renderWithProviders";

it("keeps pending status navigable and static without automatic announcements or animation", async () => {
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
  const loop = jest.spyOn(Animated, "loop");
  await render_with_providers(<AIThinking />);
  const label = screen.getByText("Preparing answer…");
  expect(label.props.accessibilityLiveRegion).toBe("none");
  expect(label.props.accessible).toBe(true);
  expect(label.props.accessibilityRole).not.toBe("alert");
  await act(async () => jest.advanceTimersByTime(2000));
  expect(announce).not.toHaveBeenCalled();
  expect(loop).not.toHaveBeenCalled();
  expect(screen.queryByTestId("ai-status-orb", { includeHiddenElements: true })).toBeNull();
});
it("keeps compact transcription status quiet with reduced motion", async () => {
  await render_with_providers(<AIStatus compact label="Transcribing…" />, { reduceMotion: true });
  expect(screen.getByText("Transcribing…").props.accessibilityLiveRegion).toBe("none");
});
