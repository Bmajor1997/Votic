import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { render_with_providers } from "../renderWithProviders";

function Tints() {
  const { theme } = useVoticTheme();
  return <Text testID="tints">{`${theme.brandTint} ${theme.hero}`}</Text>;
}
async function tints_for(accentName: string, appearanceMode = "light") {
  await AsyncStorage.setItem(
    "votic.mobile.theme.v1",
    JSON.stringify({ accentName, accentChosen: true, appearanceMode }),
  );
  const view = await render_with_providers(<Tints />);
  await waitFor(() => expect(screen.getByTestId("tints")).toBeTruthy());
  const value = String(screen.getByTestId("tints").props.children);
  view.unmount();
  return value;
}

describe("Backgrounds behind icons", () => {
  it("take on the chosen accent color in light and dark mode", async () => {
    const blue = await tints_for("blue");
    const pink = await tints_for("pink");
    expect(pink).not.toEqual(blue);
    expect(blue).toBe("#e5ecfd #efeef0");
    expect(await tints_for("pink", "dark")).not.toEqual(await tints_for("blue", "dark"));
  });
});
