import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { Screen, ScrollFadeItem } from "../../src/components/Screen";
import { LIBRARY_KEY } from "../../src/documents/documentStorage";
import { renderWithProviders } from "../renderWithProviders";

describe("Screen", () => {
  it("keeps content inside fading items pressable", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Screen title="Example">
        <ScrollFadeItem>
          <Pressable accessibilityRole="button" accessibilityLabel="Inner action" onPress={onPress}>
            <Text>Inner action</Text>
          </Pressable>
        </ScrollFadeItem>
      </Screen>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Inner action" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("alerts when the saved library cannot be read", async () => {
    await AsyncStorage.setItem(LIBRARY_KEY, "{not json");
    await renderWithProviders(<Screen title="Example" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Your stored data has not been overwritten/)).toBeTruthy();
  });
});
