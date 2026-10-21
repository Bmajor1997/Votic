import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import ImportWebScreen from "../../app/import-web";
import { import_web_page } from "../../src/api/voticApi";
import { render_with_providers } from "../renderWithProviders";

jest.mock("../../src/api/voticApi", () => ({ import_web_page: jest.fn() }));

describe("Import webpage", () => {
  it("empties the address box in one tap, so a new paste doesn't join an old link", async () => {
    await render_with_providers(<ImportWebScreen />);
    expect(screen.queryByRole("button", { name: "Clear webpage address" })).toBeNull();
    const field = screen.getByLabelText("Webpage address");
    await fireEvent.changeText(field, "https://www.britannica.com/biography/William-Wallace");
    await fireEvent.press(screen.getByRole("button", { name: "Clear webpage address" }));
    expect(screen.getByLabelText("Webpage address")).toHaveDisplayValue("");
    expect(screen.queryByRole("button", { name: "Clear webpage address" })).toBeNull();
  });

  it("shows the server's reason when an import fails", async () => {
    const alert = jest.spyOn(Alert, "alert");
    jest
      .mocked(import_web_page)
      .mockRejectedValueOnce(
        new Error("That box has more than one webpage address. Keep just one link, then try again."),
      );
    await render_with_providers(<ImportWebScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Webpage address"),
      "https://a.test/onehttps://b.test/two",
    );
    await fireEvent.press(screen.getByText("Import and clean"));
    expect(alert).toHaveBeenCalledWith(
      "Could not import webpage",
      "That box has more than one webpage address. Keep just one link, then try again.",
    );
  });
});
