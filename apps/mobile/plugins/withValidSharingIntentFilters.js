/**
 * Expo Sharing uses an internal marker to identify generated intent filters.
 * It must not be serialized into AndroidManifest.xml: Android lint rejects
 * unnamespaced attributes on <intent-filter>.
 *
 * Run this config plugin after expo-sharing so its filters remain intact while
 * only the build-time marker is removed from the final manifest.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withValidSharingIntentFilters(config) {
  return withAndroidManifest(config, (mod) => {
    const applications = mod.modResults.manifest.application || [];
    for (const application of applications) {
      for (const activity of application.activity || []) {
        for (const filter of activity["intent-filter"] || []) {
          if (filter.$) delete filter.$["expo-sharing-intent-filters"];
        }
      }
    }
    return mod;
  });
};
