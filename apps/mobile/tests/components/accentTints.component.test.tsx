import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { renderWithProviders } from "../renderWithProviders";

function Tints() {
  const { theme } = useVoticTheme();
  return <Text testID="tints">{`${theme.brandTint} ${theme.hero}`}</Text>;
}
async function tintsFor(accentName: string, appearanceMode = "light") {
  await AsyncStorage.setItem(
    "votic.mobile.theme.v1",
    JSON.stringify({ accentName, accentChosen: true, appearanceMode }),
  );
  const view = await renderWithProviders(<Tints />);
  await waitFor(() => expect(screen.getByTestId("tints")).toBeTruthy());
  const value = String(screen.getByTestId("tints").props.children);
  view.unmount();
  return value;
}

describe("Backgrounds behind icons", () => {
  it("take on the chosen accent color in light and dark mode", async () => {
    const blue = await tintsFor("blue");
    const red = await tintsFor("red");
    expect(red).not.toEqual(blue);
    expect(blue).toBe("#e5ecfd #dce6fc");
    expect(await tintsFor("red", "dark")).not.toEqual(await tintsFor("blue", "dark"));
  });
});
