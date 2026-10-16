import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import Settings from "../../app/(tabs)/settings";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { render_with_providers } from "../renderWithProviders";

const URL = "https://votic.userjot.com/?openFeedback";

describe("Votic feedback", () => {
  it("opens the UserJot submission form from Settings without attaching personal data", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Share feedback" }));
    expect(open).toHaveBeenCalledWith(URL);
  });

  it("appears once, on the main Settings page, not again under Help", async () => {
    await render_with_providers(<SettingsDetailScreen category="help" />);
    expect(screen.queryByRole("button", { name: "Share feedback" })).toBeNull();
  });

  it("can be retried after the browser fails to open", async () => {
    const open = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("browser unavailable"))
      .mockResolvedValue(true);
    await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Share feedback" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Share feedback" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(open).toHaveBeenLastCalledWith(URL);
  });
});
