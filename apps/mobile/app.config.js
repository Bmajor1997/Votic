/**
 * Adds native Google Sign-In when its iOS URL scheme is provided (the reversed iOS client ID from
 * Google Cloud, e.g. com.googleusercontent.apps.123-abc). Without it, builds still work and the
 * Google button stays hidden. See the README's "Accounts" section.
 */
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === "production")
    require("../../security/check-mobile-release.cjs").validate_release_environment(process.env, config);
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    extra: {
      ...config.extra,
      ...(process.env.EAS_PROJECT_ID
        ? { eas: { ...config.extra?.eas, projectId: process.env.EAS_PROJECT_ID } }
        : {}),
      // EAS supplies this on the build worker. Production and local release bundles fail closed.
      previewTesting: process.env.EAS_BUILD_PROFILE === "preview",
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]] : []),
    ],
  };
};
