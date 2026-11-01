import AsyncStorage from "@react-native-async-storage/async-storage";
import { expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { AI_CONSENT_VERSION, require_ai_consent } from "../../src/api/aiConsent";
import { account_storage_key } from "../../src/storage/accountStorage";
import { fakeAuth } from "../mocks/authBackend";
import { render_with_providers } from "../renderWithProviders";
function Harness() {
  const [result, setResult] = useState("");
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try AI"
        onPress={() => {
          void require_ai_consent().then(
            () => setResult("accepted"),
            () => setResult("declined"),
          );
        }}
      >
        <Text>Try AI</Text>
      </Pressable>
      <Text>{result}</Text>
    </>
  );
}
it("requires agreement, permits decline, and saves only an account-scoped version", async () => {
  await render_with_providers(<Harness />);
  const key = account_storage_key(`votic.mobile.ai-consent.${AI_CONSENT_VERSION}`, fakeAuth.user!.uid);
  await AsyncStorage.removeItem(key);
  await fireEvent.press(screen.getByRole("button", { name: "Try AI" }));
  expect(screen.getByText("Before using AI features")).toBeTruthy();
  expect(await AsyncStorage.getItem(key)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Decline" }));
  expect(screen.getByText("declined")).toBeTruthy();
  expect(await AsyncStorage.getItem(key)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try AI" }));
  await fireEvent.press(screen.getByRole("button", { name: "Agree to AI sharing" }));
  expect(screen.getByText("accepted")).toBeTruthy();
  expect(await AsyncStorage.getItem(key)).toBe(AI_CONSENT_VERSION);
});
