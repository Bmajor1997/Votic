const { withDangerousMod, withPodfile } = require("expo/config-plugins");
const { harden_android, harden_podfile } = require("./nativeDependencyHardening.cjs");

module.exports = function withNativeDependencyHardening(config) {
  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      harden_android(mod.modRequest.projectRoot);
      return mod;
    },
  ]);
  return withPodfile(config, (mod) => {
    mod.modResults.contents = harden_podfile(mod.modResults.contents);
    return mod;
  });
};
