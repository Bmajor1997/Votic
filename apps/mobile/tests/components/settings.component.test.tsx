import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { render_with_providers } from "../renderWithProviders";

describe("Settings reading spacing", () => {
  it("labels each spacing option distinctly", async () => {
    await render_with_providers(<SettingsDetailScreen category="reading" />);
    expect(screen.getByRole("radio", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Extra" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default text size" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default reading spacing" })).toBeTruthy();
    expect(screen.getByLabelText("Reading spacing").props.accessibilityRole).toBe("radiogroup");
  });
  it("selects Compact when it is pressed", async () => {
    await render_with_providers(<SettingsDetailScreen category="reading" />);
    await fireEvent.press(screen.getByRole("radio", { name: "Compact" }));
    expect(await screen.findByRole("radio", { name: "Compact", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default reading spacing", checked: false })).toBeTruthy();
  });
});

it("restores narration choices and lets an initially disabled highlight be enabled again", async () => {
  const view = await render_with_providers(<SettingsDetailScreen category="reading" />);
  await act(async () => {});
  for (const name of ["Off", "Sentence", "Word", "Both"])
    expect(screen.getByRole("radio", { name })).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Off" }));
  await act(async () => {});
  expect(
    JSON.parse((await AsyncStorage.getItem("votic.mobile.personalization-preferences.v1:test-user"))!),
  ).toMatchObject({ highlightMode: "off" });
  await fireEvent(screen.getByRole("switch", { name: "Sentence flow" }), "valueChange", false);
  await fireEvent(screen.getByRole("switch", { name: "Emphasize current word" }), "valueChange", false);
  await act(async () => {});
  expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1"))!)).toMatchObject({
    sentenceFlow: false,
    wordEmphasis: false,
  });
  await view.unmount();
  await render_with_providers(<SettingsDetailScreen category="reading" />);
  await act(async () => {});
  expect(screen.getByRole("radio", { name: "Off", checked: true })).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Sentence flow" }).props.value).toBe(false);
  expect(screen.getByRole("switch", { name: "Emphasize current word" }).props.value).toBe(false);
  await fireEvent.press(screen.getByRole("radio", { name: "Both" }));
  expect(screen.getByRole("radio", { name: "Both", checked: true })).toBeTruthy();
});
