const { withDangerousMod, withPodfile } = require("expo/config-plugins");
const { hardenAndroid, hardenPodfile } = require("./nativeDependencyHardening.cjs");

module.exports = function withNativeDependencyHardening(config) {
  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      hardenAndroid(mod.modRequest.projectRoot);
      return mod;
    },
  ]);
  return withPodfile(config, (mod) => {
    mod.modResults.contents = hardenPodfile(mod.modResults.contents);
    return mod;
  });
};
