import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { ThemeProvider, accentColors, useVoticTheme } from "../../src/theme/ThemeProvider";

const THEME_KEY = "votic.mobile.theme.v1";

function Probe() {
  const { accentName, setAccentName, theme } = useVoticTheme();
  return (
    <>
      <Text testID="accent">{`${accentName} ${theme.accent}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pick orange"
        onPress={() => setAccentName("orange")}
      />
    </>
  );
}
async function renderTheme() {
  await render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  await act(async () => {});
}
const accent = () => screen.getByTestId("accent").props.children;
const saved = async () => JSON.parse((await AsyncStorage.getItem(THEME_KEY)) || "{}");

describe("Votic's color", () => {
  it("is blue by default", async () => {
    await renderTheme();
    expect(accent()).toBe(`blue ${accentColors.blue}`);
  });

  it("moves the old automatic orange to blue", async () => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: "orange", appearanceMode: "dark" }));
    await renderTheme();
    expect(accent()).toBe(`blue ${accentColors.blue}`);
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ accentName: "blue", accentChosen: false }),
    );
  });

  it("keeps a color picked in Settings, orange included", async () => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: "purple", appearanceMode: "light" }));
    await renderTheme();
    expect(accent()).toBe(`purple ${accentColors.purple}`);
    await fireEvent.press(screen.getByRole("button", { name: "Pick orange" }));
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ accentName: "orange", accentChosen: true }),
    );
    screen.unmount();
    await renderTheme();
    await waitFor(() => expect(accent()).toBe(`orange ${accentColors.orange}`));
  });
});
