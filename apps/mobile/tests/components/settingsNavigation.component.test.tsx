import AsyncStorage from "@react-native-async-storage/async-storage";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Settings from "../../app/(tabs)/settings";
import SettingsDetailRoute from "../../app/settings/[category]";
import { SettingsDetailScreen } from "../../src/settings/SettingsDetails";
import { SETTINGS_CATEGORIES, SettingsCategory } from "../../src/settings/SettingsNavigation";
import { fakeAuth } from "../mocks/authBackend";
import { router, searchParams } from "../mocks/expoRouter";
import { AppProviders, render_with_providers } from "../renderWithProviders";

describe("Settings categories", () => {
  it("shows account identity and accessible category rows without expanded controls", async () => {
    await render_with_providers(<Settings />);
    expect(screen.getByText("reader@example.com")).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toEqual([]);
    expect(screen.queryAllByRole("switch")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    const rows = screen.getAllByRole("button");
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      "Account & Membership",
      "AI Credits & Usage",
      "Appearance",
      "Reading & Listening",
      "Accessibility",
      "Personalization",
      "Help",
      "Feedback",
    ]);
    for (const row of rows) {
      expect(row.props.accessibilityHint).toMatch(/^Opens/);
      expect(row.props.accessibilityValue.text).toBeTruthy();
      expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it.each(Object.entries(SETTINGS_CATEGORIES) as [SettingsCategory, string][])(
    "opens the %s category through its accessible row",
    async (category, title) => {
      const rendered = await render_with_providers(<Settings />);
      await fireEvent.press(screen.getByRole("button", { name: title }));
      expect(router.push).toHaveBeenCalledWith({ pathname: "/settings/[category]", params: { category } });
      searchParams.current = { category };
      await rendered.rerender(
        <AppProviders>
          <SettingsDetailRoute />
        </AppProviders>,
      );
      expect(screen.getByRole("header", { name: title })).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Back to Settings" }));
      expect(router.back).toHaveBeenCalledTimes(1);
    },
  );

  it("opens AI Usage as its own page, separate from Reading Statistics", async () => {
    await render_with_providers(<Settings />);
    expect(screen.getByRole("header", { name: "AI CREDITS & USAGE" })).toBeTruthy();
    const row = screen.getByRole("button", { name: "AI Credits & Usage" });
    expect(row.props.accessibilityValue.text).toBe("Monthly allowance, additional credits, and renewal date");
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/ai-usage");
    expect(router.push).not.toHaveBeenCalledWith("/statistics");
  });

  it("returns a directly opened detail screen to Settings without navigation history", async () => {
    router.canGoBack.mockReturnValue(false);
    await render_with_providers(<SettingsDetailScreen category="appearance" />);
    await fireEvent.press(screen.getByRole("button", { name: "Back to Settings" }));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/settings");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("handles an unknown category without exposing account actions", async () => {
    searchParams.current = { category: "toString" };
    await render_with_providers(<SettingsDetailRoute />);
    expect(screen.getByText(/This settings category is unavailable/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to Settings" })).toBeTruthy();
  });

  it("preserves the account entry when signed out, without store actions for a missing account", async () => {
    fakeAuth.reset(null);
    const rendered = await render_with_providers(<Settings />);
    expect(screen.getByRole("button", { name: "Account & Membership" })).toBeTruthy();
    await rendered.rerender(
      <AppProviders>
        <SettingsDetailScreen category="account" />
      </AppProviders>,
    );
    expect(screen.getByText("Not signed in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Votic Plus" })).toBeNull();
  });
});

describe("Settings preferences", () => {
  it("keeps every accent color name on one line", async () => {
    await render_with_providers(<SettingsDetailScreen category="appearance" />);
    for (const name of ["Blue", "Purple", "Pink", "Orange", "Green", "Graphite"]) {
      const label = screen.getByText(name);
      expect(label.props.numberOfLines).toBe(1);
      expect(label.props.adjustsFontSizeToFit).toBe(true);
    }
  });

  it("updates appearance and accent immediately, persists them, and refreshes the overview summary", async () => {
    const announcement = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const rendered = await render_with_providers(<SettingsDetailScreen category="appearance" />);
    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
    await fireEvent.press(screen.getByRole("radio", { name: "purple accent color" }));
    expect(await screen.findByRole("radio", { name: "Dark", checked: true })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: "purple accent color", checked: true })).toBeTruthy();
    expect(announcement).toHaveBeenCalledWith("Dark selected for app appearance.");
    expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.theme.v1"))!)).toMatchObject({
      appearanceMode: "dark",
      accentName: "purple",
    });
    await rendered.rerender(
      <AppProviders>
        <Settings />
      </AppProviders>,
    );
    expect((await screen.findByRole("button", { name: "Appearance" })).props.accessibilityValue.text).toBe(
      "Dark mode · Purple accent",
    );
    await rendered.unmount();
    await render_with_providers(<SettingsDetailScreen category="appearance" />);
    expect(await screen.findByRole("radio", { name: "Dark", checked: true })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: "purple accent color", checked: true })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Sepia" })).toBeNull();
  });

  it("persists text, spacing, emphasis, and motion using the existing preferences", async () => {
    const rendered = await render_with_providers(<SettingsDetailScreen category="reading" />);
    await fireEvent.press(screen.getByRole("radio", { name: "Extra large text size" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Extra" }));
    await fireEvent(screen.getByRole("switch", { name: "Emphasize current word" }), "valueChange", false);
    await rendered.rerender(
      <AppProviders>
        <SettingsDetailScreen category="accessibility" />
      </AppProviders>,
    );
    await fireEvent(screen.getByRole("switch", { name: "Reduce motion" }), "valueChange", true);
    expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1"))!)).toMatchObject({
      textSize: "extra-large",
      readingSpacing: "extra",
      wordEmphasis: false,
      reduceMotion: true,
    });
    await rendered.unmount();
    const restored = await render_with_providers(<SettingsDetailScreen category="reading" />);
    expect(await screen.findByRole("radio", { name: "Extra large text size", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Extra", checked: true })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Emphasize current word", checked: false })).toBeTruthy();
    await restored.rerender(
      <AppProviders>
        <SettingsDetailScreen category="accessibility" />
      </AppProviders>,
    );
    expect(screen.getByRole("switch", { name: "Reduce motion", checked: true })).toBeTruthy();
  });

  it("shares High contrast with the Reader and links text size to Reading & Listening", async () => {
    await render_with_providers(<SettingsDetailScreen category="accessibility" />);
    const toggle = screen.getByRole("switch", { name: "High contrast reading" });
    expect(toggle.props.accessibilityHint).toMatch(/Reader/);
    await fireEvent(toggle, "valueChange", true);
    expect(JSON.parse((await AsyncStorage.getItem("votic.mobile.accessibility.v1"))!)).toMatchObject({
      highContrast: true,
    });
    // Text size is owned by Reading & Listening; Accessibility shows its value and links there.
    expect(screen.queryByRole("radio", { name: "Large text size" })).toBeNull();
    const link = screen.getByRole("button", { name: "Text size and spacing" });
    expect(link.props.accessibilityValue.text).toBe("Default text · Default spacing");
    await fireEvent.press(link);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/settings/[category]",
      params: { category: "reading" },
    });
  });

  it("explains and locks Reduce motion while the device setting is on", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render_with_providers(<SettingsDetailScreen category="accessibility" />);
    const toggle = await screen.findByRole("switch", { name: "Reduce motion", checked: true });
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.accessibilityHint).toMatch(/device's Reduce Motion setting is on/);
  });

  it("retains personalization choices after remount", async () => {
    const rendered = await render_with_providers(<SettingsDetailScreen category="personalization" />);
    // The setup answers are edited from here; the old single focus choice is gone.
    expect(screen.getByRole("button", { name: "Your answers" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /^Research\./ })).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "Simple" }));
    expect(
      JSON.parse((await AsyncStorage.getItem("votic.mobile.personalization-preferences.v1:test-user"))!),
    ).toMatchObject({ explanationStyle: "simple" });
    await rendered.unmount();
    await render_with_providers(<SettingsDetailScreen category="personalization" />);
    expect(await screen.findByRole("radio", { name: "Simple", checked: true })).toBeTruthy();
  });

  it("keeps Statistics available from Help", async () => {
    await render_with_providers(<SettingsDetailScreen category="help" />);
    await fireEvent.press(screen.getByRole("button", { name: "Statistics" }));
    expect(router.push).toHaveBeenCalledWith("/statistics");
  });
});
