/**
 * Android switches app icons by enabling an <activity-alias> and disabling MainActivity. Without this
 * plugin, the aliases only get the launcher filter, so once a colored icon is chosen, votic:// links (the
 * home-screen widgets, sign-in redirects) and "Share to Votic" from other apps would stop opening Votic.
 * This copies every MainActivity intent filter onto each alias, so they all keep working whichever icon is on.
 */
const { withAndroidManifest } = require("expo/config-plugins");
const { copyFilters } = require("./iconAliasFilters");

module.exports = function withIconAliasIntentFilters(config) {
  return withAndroidManifest(config, (result) => {
    result.modResults = copyFilters(result.modResults);
    return result;
  });
};
