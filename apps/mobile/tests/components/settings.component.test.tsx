import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { renderWithProviders } from "../renderWithProviders";

describe("Settings reading spacing", () => {
  it("labels each spacing option distinctly", async () => {
    await renderWithProviders(<SettingsDetailScreen category="reading" />);
    expect(screen.getByRole("radio", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Extra" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default text size" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default reading spacing" })).toBeTruthy();
    expect(screen.getByLabelText("Reading spacing").props.accessibilityRole).toBe("radiogroup");
  });
  it("selects Compact when it is pressed", async () => {
    await renderWithProviders(<SettingsDetailScreen category="reading" />);
    await fireEvent.press(screen.getByRole("radio", { name: "Compact" }));
    expect(await screen.findByRole("radio", { name: "Compact", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default reading spacing", checked: false })).toBeTruthy();
  });
});
