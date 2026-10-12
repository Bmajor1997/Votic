import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it } from "@jest/globals";
import { screen, waitFor } from "@testing-library/react-native";
import { AskVoticEmptyAnimation } from "../../src/components/EmptyStateIllustrations";
import { accentColors } from "../../src/theme/ThemeProvider";
import { renderWithProviders } from "../renderWithProviders";

describe("Ask Votic mascot", () => {
  it("colors its wings with the accent chosen in Settings", async () => {
    await AsyncStorage.setItem(
      "votic.mobile.theme.v1",
      JSON.stringify({ accentName: "purple", accentChosen: true, appearanceMode: "light" }),
    );
    await renderWithProviders(<AskVoticEmptyAnimation />);
    await waitFor(() =>
      expect(screen.getByTestId("ask-mascot-wings").props.tintColor).toBe(accentColors.purple),
    );
    expect(screen.getByLabelText("Votic looking through a magnifying glass")).toBeTruthy();
  });

  it("uses Votic blue by default", async () => {
    await renderWithProviders(<AskVoticEmptyAnimation />);
    expect(screen.getByTestId("ask-mascot-wings").props.tintColor).toBe(accentColors.blue);
  });
});
