import { account_storage_key } from "../../src/storage/accountStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { Screen } from "../../src/components/Screen";
import { LIBRARY_KEY } from "../../src/documents/documentStorage";
import { render_with_providers } from "../renderWithProviders";

describe("Screen", () => {
  it("keeps content pressable under the scroll edge fades, and hides the fades from screen readers", async () => {
    const onPress = jest.fn();
    await render_with_providers(
      <Screen title="Example">
        <Pressable accessibilityRole="button" accessibilityLabel="Inner action" onPress={onPress}>
          <Text>Inner action</Text>
        </Pressable>
      </Screen>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Inner action" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    for (const edge of ["top", "bottom"]) {
      const fade = screen.getByTestId(`scroll-fade-${edge}`, { includeHiddenElements: true });
      expect(fade.props.pointerEvents).toBe("none");
      expect(fade.props.importantForAccessibility).toBe("no-hide-descendants");
    }
  });

  it("alerts when the saved library cannot be read", async () => {
    await AsyncStorage.setItem(account_storage_key(LIBRARY_KEY, "test-user"), "{not json");
    await render_with_providers(<Screen title="Example" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Your stored data has not been overwritten/)).toBeTruthy();
  });
});
