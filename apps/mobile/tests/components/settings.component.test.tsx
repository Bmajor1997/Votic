import { beforeEach, describe, expect, it } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen } from "@testing-library/react-native";
import Settings from "../../app/(tabs)/settings";
import { renderWithProviders } from "../renderWithProviders";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("Settings reading spacing", () => {
  it("labels each spacing option distinctly", async () => {
    await renderWithProviders(<Settings />);
    expect(await screen.findByRole("radio", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Extra" })).toBeTruthy();
    // Text size also has a "Default" option; the two controls are not yet grouped for screen readers.
    expect(screen.getAllByRole("radio", { name: "Default" })).toHaveLength(2);
  });
  it("selects Compact when it is pressed", async () => {
    await renderWithProviders(<Settings />);
    const compact = await screen.findByRole("radio", { name: "Compact" });
    fireEvent.press(compact);
    expect(await screen.findByRole("radio", { name: "Compact", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Default", checked: false })).toBeTruthy();
  });
});
