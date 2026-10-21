import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import Settings from "../../app/(tabs)/settings";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { render_with_providers } from "../renderWithProviders";

describe("Votic feedback entry", () => {
  it("opens native Feedback from Settings without opening a browser", async () => {
    const open = jest.spyOn(Linking, "openURL");
    await render_with_providers(<Settings />);
    await fireEvent.press(screen.getByRole("button", { name: "Feedback" }));
    expect(router.push).toHaveBeenCalledWith("/feedback");
    expect(open).not.toHaveBeenCalled();
  });
  it("appears once on main Settings, not again under Help", async () => {
    await render_with_providers(<SettingsDetailScreen category="help" />);
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull();
  });
});
