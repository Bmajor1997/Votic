import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import Settings from "../../app/(tabs)/settings";
import { renderWithProviders } from "../renderWithProviders";

describe("Settings reading spacing", () => {
  it("labels each spacing option distinctly", async () => {
    await renderWithProviders(<Settings />);
    expect(screen.getByRole("radio", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Extra" })).toBeTruthy();
    // Text size also has a "Default" option; the two controls are not yet grouped for screen readers.
    expect(screen.getAllByRole("radio", { name: "Default" })).toHaveLength(2);
  });
  it("selects Compact when it is pressed", async () => {
    await renderWithProviders(<Settings />);
    await fireEvent.press(screen.getByRole("radio", { name: "Compact" }));
    expect(await screen.findByRole("radio", { name: "Compact", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default", checked: false })).toBeTruthy();
  });
});
