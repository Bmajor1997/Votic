import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { DEVICE_HISTORY_KEY } from "../../src/onboarding/onboardingStorage";
import { stackScreens } from "../mocks/expoRouter";

// The real services read build configuration; this signs in an account so the app itself is shown.
jest.mock("../../src/config/appServices", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  createAppServices: () => require("../mocks/accountServices").fakeServices(),
}));

describe("root navigation", () => {
  it("opens the Reader over the current screen without a competing stack animation", async () => {
    await AsyncStorage.setItem(DEVICE_HISTORY_KEY, "existing");
    await render(<RootLayout />);
    await act(async () => {});
    const reader = stackScreens.find((screen) => screen.name === "reader");
    // transparentModal keeps the source screen mounted so the Reader can grow out of the tapped card.
    expect(reader?.options).toMatchObject({
      animation: "none",
      presentation: "transparentModal",
      contentStyle: { backgroundColor: "transparent" },
    });
    expect(stackScreens.map((screen) => screen.name)).toEqual(
      expect.arrayContaining(["(tabs)", "reader", "assistant", "review", "recap"]),
    );
  });
});
