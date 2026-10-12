/** Copies every MainActivity intent filter onto each icon alias (see withIconAliasIntentFilters.js). */
function copyFilters(manifest) {
  const application = manifest.manifest?.application?.[0];
  const main = (application?.activity ?? []).find(
    (activity) => activity.$["android:name"] === ".MainActivity",
  );
  if (!main) return manifest;
  for (const alias of application["activity-alias"] ?? []) {
    if (alias.$["android:targetActivity"] !== ".MainActivity") continue;
    alias["intent-filter"] = JSON.parse(JSON.stringify(main["intent-filter"] ?? []));
  }
  return manifest;
}
module.exports = { copyFilters };
