/**
 * Adds native Google Sign-In when its iOS URL scheme is provided (the reversed iOS client ID from
 * Google Cloud, e.g. com.googleusercontent.apps.123-abc). Without it, builds still work and the
 * Google button stays hidden. See the README's "Accounts" section.
 */
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }]] : []),
    ],
  };
};
