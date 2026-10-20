const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = path.resolve(process.argv[2] || "apps/mobile/android/app/src/main");
const res = path.join(app, "res");
const manifest = fs.readFileSync(path.join(app, "AndroidManifest.xml"), "utf8");
assert.doesNotMatch(manifest, /expo-sharing-intent-filters/);
assert.match(manifest, /android.hardware.camera[^>]*android:required="false"/);
assert.doesNotMatch(manifest, /android:screenOrientation="unspecified"/);
assert.match(manifest, /android.intent.action.SEND/);
assert.match(manifest, /android:mimeType="application\/pdf"/);
assert.match(manifest, /android.permission.WRITE_EXTERNAL_STORAGE[^>]*tools:node="remove"/);
const background = fs.readFileSync(path.join(res, "drawable/rn_edit_text_material.xml"), "utf8");
assert.doesNotMatch(background, /@(?:dimen|drawable)\/abc_/);
assert.match(background, /@drawable\/votic_textfield_activated_mtrl_alpha/);
for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const dir = path.join(res, `mipmap-${density}`);
  const icon = fs.readFileSync(path.join(dir, "ic_launcher.png"));
  assert.equal(icon.readUInt32BE(0), 0x89504e47, "launcher must be a real PNG");
  assert.deepEqual(icon, fs.readFileSync(path.join(dir, "ic_launcher_round.png")));
  assert.equal(fs.readdirSync(dir).filter(name => name.endsWith(".webp")).length, 0);
}
for (const name of ["ic_launcher", "ic_launcher_round"]) {
  assert.match(fs.readFileSync(path.join(res, `mipmap-anydpi-v26/${name}.xml`), "utf8"),
    /<monochrome android:drawable="@drawable\/votic_launcher_monochrome"/);
}
assert.match(fs.readFileSync(path.join(res, "raw/votic_resource_keep.xml"), "utf8"), /@string\/share_into_scheme/);
console.log("Generated Android manifest, sharing filters, text fields and icon resources verified.");
