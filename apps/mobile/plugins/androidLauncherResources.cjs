const fs = require("node:fs/promises");
const path = require("node:path");

/** Expo's splash XML must not share a resource name with the adaptive icon's background bitmaps. */
async function configureLauncherBackground(res, hasBackgroundImage) {
  const original = path.join(res, "drawable/ic_launcher_background.xml");
  const splash = path.join(res, "drawable/votic_splash_background.xml");
  try {
    await fs.rename(original, splash);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Repeated prebuilds are safe; a missing template altogether still needs review.
    await fs.access(splash);
  }
  const stylesPath = path.join(res, "values/styles.xml");
  const styles = await fs.readFile(stylesPath, "utf8");
  await fs.writeFile(
    stylesPath,
    styles.replace(
      /(<item name="android:windowBackground">)@drawable\/(?:splashscreen_logo|ic_launcher_background)(<\/item>)/g,
      "$1@drawable/votic_splash_background$2",
    ),
  );
  // Adaptive icons use either the image or this color. Preserve the color-only configuration.
  if (hasBackgroundImage) {
    const colorsPath = path.join(res, "values/colors.xml");
    const colors = await fs.readFile(colorsPath, "utf8");
    await fs.writeFile(colorsPath, colors.replace(/\s*<color name="iconBackground">[^<]*<\/color>/g, ""));
  }
}

module.exports = { configureLauncherBackground };
