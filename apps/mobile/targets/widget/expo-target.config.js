/**
 * The iPhone home-screen and Lock Screen widgets (WidgetKit). @bacons/apple-targets adds this folder to the
 * Xcode project as a widget extension on `npx expo prebuild`; see docs/HOME_SCREEN_WIDGETS.md.
 *
 * The app shares its widget snapshot through the App Group set in app.json (ios.entitlements), so the
 * extension uses the same one.
 */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "VoticWidgets",
  displayName: "Votic",
  bundleIdentifier: ".widgets",
  // Matches the app's minimum iOS version, so every iPhone that runs Votic gets the widgets.
  deploymentTarget: "16.4",
  frameworks: ["SwiftUI", "WidgetKit"],
  colors: {
    $accent: { light: "#245BC2", dark: "#91B8FF" },
    $widgetBackground: { light: "#D8E6FF", dark: "#17345B" },
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
