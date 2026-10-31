// SQLite grows on demand. This ceiling is shared by local accounts, not a cloud quota or reservation.
const DATABASE_LIMIT_MB = "128";
function configureProperties(properties) {
  return [
    ...properties.filter((entry) => entry.type !== "property" || entry.key !== "AsyncStorage_db_size_in_MB"),
    { type: "property", key: "AsyncStorage_db_size_in_MB", value: DATABASE_LIMIT_MB },
  ];
}
module.exports = function withLocalLibraryStorage(config) {
  const { withGradleProperties } = require("expo/config-plugins");
  return withGradleProperties(config, (mod) => {
    mod.modResults = configureProperties(mod.modResults);
    return mod;
  });
};
module.exports.configureProperties = configureProperties;
