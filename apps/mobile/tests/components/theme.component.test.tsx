import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
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
async function render_theme() {
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
    await render_theme();
    expect(accent()).toBe(`blue ${accentColors.blue}`);
  });

  it.each([
    ["indigo", "blue"],
    ["red", "pink"],
    ["rose", "pink"],
    ["amber", "orange"],
    ["teal", "green"],
    ["emerald", "green"],
  ])("moves a retired %s choice to the closest current color, %s", async (retired, current) => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: retired, appearanceMode: "light" }));
    await render_theme();
    await waitFor(() =>
      expect(accent()).toBe(`${current} ${accentColors[current as keyof typeof accentColors]}`),
    );
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ accentName: current, accentChosen: true }),
    );
  });

  it("falls back to blue for an unknown saved color", async () => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: "toString", accentChosen: true }));
    await render_theme();
    expect(accent()).toBe(`blue ${accentColors.blue}`);
  });

  it("moves the old automatic orange to blue", async () => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: "orange", appearanceMode: "dark" }));
    await render_theme();
    expect(accent()).toBe(`blue ${accentColors.blue}`);
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ accentName: "blue", accentChosen: false }),
    );
  });

  it("keeps a color picked in Settings, orange included", async () => {
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ accentName: "purple", appearanceMode: "light" }));
    await render_theme();
    expect(accent()).toBe(`purple ${accentColors.purple}`);
    await fireEvent.press(screen.getByRole("button", { name: "Pick orange" }));
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ accentName: "orange", accentChosen: true }),
    );
    await screen.unmount();
    await render_theme();
    await waitFor(() => expect(accent()).toBe(`orange ${accentColors.orange}`));
  });
});

function AppearanceProbe() {
  const { theme, setAppearanceMode } = useVoticTheme();
  return (
    <>
      <Text testID="background">{theme.background}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use Light"
        onPress={() => setAppearanceMode("light")}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use Dark"
        onPress={() => setAppearanceMode("dark")}
      />
    </>
  );
}
describe("Neutral app appearance", () => {
  it("follows live system changes while explicit modes stay fixed", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    await AsyncStorage.setItem(THEME_KEY, JSON.stringify({ appearanceMode: "system" }));
    const view = await render(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("background")).toHaveTextContent("#FFFFFF");
    scheme.mockReturnValue("dark");
    await view.rerender(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("background")).toHaveTextContent("#000000");
    await fireEvent.press(screen.getByRole("button", { name: "Use Light" }));
    expect(screen.getByTestId("background")).toHaveTextContent("#FFFFFF");
    await fireEvent.press(screen.getByRole("button", { name: "Use Dark" }));
    scheme.mockReturnValue("light");
    await view.rerender(
      <ThemeProvider>
        <AppearanceProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("background")).toHaveTextContent("#000000");
  });
});
