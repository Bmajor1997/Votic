/**
 * Adds native Google Sign-In when its iOS URL scheme is provided (the reversed iOS client ID from
 * Google Cloud, e.g. com.googleusercontent.apps.123-abc). Without it, builds still work and the
 * Google button stays hidden. See the README's "Accounts" section.
 */
const { IMPORT_TYPES } = require("./config/importTypes");

module.exports = ({ config }) => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    extra: {
      ...config.extra,
      // EAS supplies this on the build worker. Production and local release bundles fail closed.
      previewTesting: process.env.EAS_BUILD_PROFILE === "preview",
    },
    plugins: [
      ...(config.plugins ?? []).map((plugin) => {
        if (!Array.isArray(plugin) || plugin[0] !== "expo-sharing") return plugin;
        const options = plugin[1] ?? {};
        return [
          plugin[0],
          {
            ...options,
            android: { ...options.android, singleShareMimeTypes: Object.keys(IMPORT_TYPES) },
          },
        ];
      }),
      ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]] : []),
    ],
  };
};
