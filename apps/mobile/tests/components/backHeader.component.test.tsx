import { describe, expect, it } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import CheckUnderstandingScreen from "../../app/check-understanding";
import ImportWeb from "../../app/import-web";
import Pronunciations from "../../app/pronunciations";
import { router } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

describe("Back header", () => {
  it.each([
    ["Import webpage", ImportWeb],
    ["Check my understanding", CheckUnderstandingScreen],
    ["Pronunciation dictionary", Pronunciations],
  ])("names the Back button and the %s heading for screen readers", async (title, Screen) => {
    await render_with_providers(<Screen />);
    expect(screen.getByRole("header", { name: title })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalled();
  });
});
