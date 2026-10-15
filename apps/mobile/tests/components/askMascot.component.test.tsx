import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react-native";
import { AskVoticEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { accentColors } from "../../src/theme/ThemeProvider";
import { render_with_providers } from "../renderWithProviders";

describe("Ask Votic mascot", () => {
  it("colors its wings with the accent chosen in Settings", async () => {
    await AsyncStorage.setItem(
      "votic.mobile.theme.v1",
      JSON.stringify({ accentName: "purple", accentChosen: true, appearanceMode: "light" }),
    );
    await render_with_providers(<AskVoticEmptyAnimation />);
    await waitFor(() =>
      expect(screen.getByTestId("ask-mascot-wings").props.tintColor).toBe(accentColors.purple),
    );
    expect(screen.getByLabelText("Votic looking through a magnifying glass")).toBeTruthy();
  });

  it("uses Votic blue by default", async () => {
    await render_with_providers(<AskVoticEmptyAnimation />);
    expect(screen.getByTestId("ask-mascot-wings").props.tintColor).toBe(accentColors.blue);
  });

  it("keeps every layer inside the mascot's box instead of the images' own 480-pixel size", async () => {
    await render_with_providers(<AskVoticEmptyAnimation />);
    const box = screen.getByLabelText("Votic looking through a magnifying glass");
    expect(StyleSheet.flatten(box.props.style)).toMatchObject({ width: 150, height: 126 });
    const layers = ["base", "wings", "shading"].map((layer) => screen.getByTestId(`ask-mascot-${layer}`));
    for (const layer of layers)
      expect(StyleSheet.flatten(layer.props.style)).toMatchObject({
        position: "absolute",
        width: "100%",
        height: "100%",
      });
  });
});
