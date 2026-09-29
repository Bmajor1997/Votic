import { describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import { stackScreens } from "../mocks/expoRouter";

describe("root navigation", () => {
  it("opens the Reader over the current screen without a competing stack animation", async () => {
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
