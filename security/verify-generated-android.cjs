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
assert.match(manifest, /android.permission.WRITE_EXTERNAL_STORAGE[^>]*android:maxSdkVersion="28"/);
assert.ok(manifest.indexOf("<uses-feature") < manifest.indexOf("<application"), "hardware declarations precede application");
const background = fs.readFileSync(path.join(res, "drawable/rn_edit_text_material.xml"), "utf8");
assert.doesNotMatch(background, /@(?:dimen|drawable)\/abc_/);
assert.match(background, /@drawable\/votic_textfield_activated_mtrl_alpha/);
assert.equal(fs.existsSync(path.join(res, "drawable/ic_launcher_background.xml")), false,
  "splash XML must not collide with the launcher background bitmaps");
assert.match(fs.readFileSync(path.join(res, "values/styles.xml"), "utf8"),
  /name="android:windowBackground">@drawable\/votic_splash_background</);
assert.match(fs.readFileSync(path.join(res, "drawable/votic_splash_background.xml"), "utf8"),
  /@drawable\/splashscreen_logo/);
const adaptiveIcon = fs.readFileSync(path.join(res, "mipmap-anydpi-v26/ic_launcher.xml"), "utf8");
if (adaptiveIcon.includes("@mipmap/ic_launcher_background")) {
  assert.doesNotMatch(fs.readFileSync(path.join(res, "values/colors.xml"), "utf8"),
    /name="iconBackground"/, "image-backed icons must not retain an unused fallback color");
}
for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const dir = path.join(res, `mipmap-${density}`);
  const icon = fs.readFileSync(path.join(dir, "ic_launcher.png"));
  assert.equal(icon.readUInt32BE(0), 0x89504e47, "launcher must be a real PNG");
  for (const layer of ["foreground", "background", "monochrome"]) {
    const bytes = fs.readFileSync(path.join(dir, `ic_launcher_${layer}.png`));
    assert.equal(bytes.readUInt32BE(0), 0x89504e47, `${layer} must be a real PNG`);
  }
  assert.equal(fs.existsSync(path.join(dir, "ic_launcher_round.png")), false, "round icon uses an alias");
  assert.equal(fs.readdirSync(dir).filter(name => name.endsWith(".webp")).length, 0);
}
assert.equal(fs.readdirSync(res).filter(name => /^drawable-.*-v4$/.test(name)).length, 0);
assert.match(fs.readFileSync(path.join(res, "values/votic_launcher_alias.xml"), "utf8"), /name="ic_launcher_round">@mipmap\/ic_launcher/);
for (const name of ["ic_launcher", "ic_launcher_round"]) {
  assert.match(fs.readFileSync(path.join(res, `mipmap-anydpi-v26/${name}.xml`), "utf8"),
    /<monochrome android:drawable="@mipmap\/ic_launcher_monochrome"/);
}
assert.match(fs.readFileSync(path.join(res, "raw/votic_resource_keep.xml"), "utf8"), /@string\/share_into_scheme/);
console.log("Generated Android manifest, sharing filters, text fields and icon resources verified.");
