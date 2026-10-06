import { expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import { AIResponse } from "../../src/components/AIResponse";
import { KeyboardDictationButton } from "../../src/components/KeyboardDictationButton";
import { renderWithProviders } from "../renderWithProviders";

it("reveals answers word by word in reading order and lets the user show the full response", async () => {
  await renderWithProviders(<AIResponse text={"First word.\nNext line."} />);
  expect(screen.getByText("Generating response")).toBeTruthy();
  expect(screen.queryByText("First word.\nNext line.")).toBeNull();
  expect(screen.getByLabelText("First word.\nNext line.")).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(80));
  expect(screen.getByText("First word.\n")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Show full response" }));
  expect(screen.getByText("First word.\nNext line.")).toBeTruthy();
  expect(screen.queryByText("Generating response")).toBeNull();
});
it("finishes the reveal and clears the generating status", async () => {
  await renderWithProviders(<AIResponse text="One two three." />);
  await act(async () => jest.advanceTimersByTime(120));
  expect(screen.getByText("One two three.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show full response" })).toBeNull();
});
it("shows complete text immediately with reduced motion", async () => {
  await renderWithProviders(<AIResponse text="A complete answer." />, { reduceMotion: true });
  expect(screen.getByText("A complete answer.")).toBeTruthy();
  expect(screen.queryByText("Generating response")).toBeNull();
});
it("offers keyboard dictation without recording or sending a question", async () => {
  const focus = jest.fn();
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await renderWithProviders(<KeyboardDictationButton onFocus={focus} />);
  await fireEvent.press(screen.getByRole("button", { name: "Use keyboard dictation" }));
  expect(focus).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === "Open keyboard")?.onPress?.());
  expect(focus).toHaveBeenCalledTimes(1);
});
