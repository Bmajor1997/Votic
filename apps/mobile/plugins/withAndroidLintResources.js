const fs = require("node:fs/promises");
const path = require("node:path");
const { Buffer } = require("node:buffer");
const { AndroidConfig, withFinalizedMod, withAppBuildGradle } = require("@expo/config-plugins");

async function updateXml(file, transform) {
  const before = await fs.readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await fs.writeFile(file, after);
}

module.exports = function withAndroidLintResources(config) {
  config = withAppBuildGradle(config, (mod) => {
    // Keep the optional decoders and React Native's core Fresco artifacts aligned.
    mod.modResults.contents = mod.modResults.contents.replaceAll(
      "${expoLibs.versions.fresco.get()}",
      "3.9.0",
    );
    if (!mod.modResults.contents.includes("// Votic Fresco alignment")) {
      mod.modResults.contents += `
// Votic Fresco alignment: avoid mixing newer optional decoders with older core artifacts.
configurations.configureEach {
    resolutionStrategy.eachDependency { details ->
        if (details.requested.group == "com.facebook.fresco") {
            details.useVersion "3.9.0"
        }
    }
}
android { lint { warningsAsErrors = true } }
`;
    }
    return mod;
  });
  return withFinalizedMod(config, [
    "android",
    async (mod) => {
      const app = path.join(mod.modRequest.platformProjectRoot, "app/src/main");
      const res = path.join(app, "res");
      const manifestPath = path.join(app, "AndroidManifest.xml");
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      configureManifest(manifest);
      await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);

      const resources = path.join(mod.modRequest.projectRoot, "plugins/android-res");
      await fs.cp(resources, res, { recursive: true });
      // Preserve RN's disabled/focused text-field visuals using owned copies of
      // AppCompat's Apache-licensed resources instead of its private identifiers.
      await updateXml(path.join(res, "drawable/rn_edit_text_material.xml"), (xml) =>
        xml
          .replaceAll("@dimen/abc_edit_text_inset_", "@dimen/votic_edit_text_inset_")
          .replaceAll("@drawable/abc_textfield_", "@drawable/votic_textfield_"),
      );

      await configureIcons(res);
      // This splash color is actually displayed, rather than left as an orphan.
      await updateXml(path.join(res, "values/styles.xml"), (xml) =>
        xml.replace(
          '<item name="android:windowBackground">@drawable/splashscreen_logo</item>',
          '<item name="android:windowBackground">@drawable/ic_launcher_background</item>',
        ),
      );
      // These names are resolved dynamically by Expo Sharing and RN dev support.
      await fs.writeFile(
        path.join(res, "raw/votic_resource_keep.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@string/share_into_scheme,@integer/react_native_dev_server_port,@string/react_native_dev_server_ip" />
`,
      );
      return mod;
    },
  ]);
};

function configureManifest(manifest) {
  // Keep the removal marker for dependency manifests. A legacy SDK bound also
  // prevents source lint from interpreting it as a request on modern Android.
  for (const permission of manifest.manifest["uses-permission"] || []) {
    if (
      permission.$["android:name"] === "android.permission.WRITE_EXTERNAL_STORAGE" &&
      permission.$["tools:node"] === "remove"
    ) {
      permission.$["android:maxSdkVersion"] = "28";
    }
  }
  const camera = "android.hardware.camera";
  const features = (manifest.manifest["uses-feature"] ||= []);
  let feature = features.find((item) => item.$["android:name"] === camera);
  if (!feature) features.push((feature = { $: { "android:name": camera } }));
  feature.$["android:required"] = "false";
  // xml2js preserves insertion order; application must follow uses-feature.
  const { application, ...declarations } = manifest.manifest;
  manifest.manifest = { ...declarations, application };
  for (const application of manifest.manifest.application || []) {
    // Leave back handling to Android/React Native's supported default.
    delete application.$["android:enableOnBackInvokedCallback"];
    for (const activity of application.activity || []) {
      if (activity.$["android:screenOrientation"] === "unspecified") {
        delete activity.$["android:screenOrientation"];
      }
    }
  }
}

async function configureIcons(res) {
  // Expo emits PNG bytes with .webp filenames. Match the extension to the bytes.
  for (const dir of await fs.readdir(res)) {
    if (!dir.startsWith("mipmap-")) continue;
    const folder = path.join(res, dir);
    for (const name of await fs.readdir(folder)) {
      if (!name.startsWith("ic_launcher") || !name.endsWith(".webp")) continue;
      const file = path.join(folder, name);
      const bytes = await fs.readFile(file);
      if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        await fs.writeFile(file.replace(/\.webp$/, ".png"), bytes);
        await fs.unlink(file);
      }
    }
    const square = path.join(folder, "ic_launcher.png");
    const round = path.join(folder, "ic_launcher_round.png");
    // Reuse the circular silhouette, then use a resource alias rather than
    // shipping identical normal/round bitmaps at every density.
    try {
      await fs.copyFile(round, square);
      await fs.unlink(round);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
      const file = path.join(folder, name);
      try {
        await updateXml(file, (xml) =>
          xml.includes("<monochrome")
            ? xml
            : xml.replace(
                "</adaptive-icon>",
                '    <monochrome android:drawable="@drawable/votic_launcher_monochrome"/>\n</adaptive-icon>',
              ),
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  await fs.writeFile(
    path.join(res, "values/votic_launcher_alias.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <item type="mipmap" name="ic_launcher_round">@mipmap/ic_launcher</item>
</resources>
`,
  );
}
