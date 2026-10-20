/**
 * Expo Sharing uses an internal marker to identify generated intent filters.
 * It must not be serialized into AndroidManifest.xml: Android lint rejects
 * unnamespaced attributes on <intent-filter>.
 *
 * Run this config plugin after expo-sharing so its filters remain intact while
 * only the build-time marker is removed from the final manifest.
 */
const path = require("node:path");
const { AndroidConfig, withFinalizedMod } = require("@expo/config-plugins");

module.exports = function withValidSharingIntentFilters(config) {
  // Expo executes regular manifest mods in reverse registration order. Finalize
  // the generated file only after expo-sharing has added its filters.
  return withFinalizedMod(config, [
    "android",
    async (mod) => {
      const manifestPath = path.join(mod.modRequest.platformProjectRoot, "app/src/main/AndroidManifest.xml");
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      const applications = manifest.manifest.application || [];
      for (const application of applications) {
        for (const activity of application.activity || []) {
          for (const filter of activity["intent-filter"] || []) {
            if (filter.$) delete filter.$["expo-sharing-intent-filters"];
          }
        }
      }
      await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
      return mod;
    },
  ]);
};
