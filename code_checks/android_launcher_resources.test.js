import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import resources from "../apps/mobile/plugins/androidLauncherResources.cjs";

const splash = '<layer-list><item android:drawable="@color/splashscreen_background"/><item><bitmap android:src="@drawable/splashscreen_logo"/></item></layer-list>';
async function fixture() {
  const res = await mkdtemp(join(tmpdir(), "votic-launcher-"));
  for (const folder of ["drawable", "values", "mipmap-hdpi"]) await mkdir(join(res, folder));
  await writeFile(join(res, "drawable/ic_launcher_background.xml"), splash);
  await writeFile(join(res, "values/styles.xml"), '<resources><style><item name="android:windowBackground">@drawable/splashscreen_logo</item></style></resources>');
  await writeFile(join(res, "values/colors.xml"), '<resources>\n  <color name="iconBackground">#D6EAFD</color>\n  <color name="splashscreen_background">#FFFFFF</color>\n</resources>');
  await writeFile(join(res, "mipmap-hdpi/ic_launcher_background.png"), "launcher artwork");
  return res;
}

test("image-backed icons keep their artwork while splash resources get a unique name and unused color is removed", async () => {
  const res = await fixture();
  try {
    await resources.configureLauncherBackground(res, true);
    await assert.rejects(access(join(res, "drawable/ic_launcher_background.xml")));
    assert.equal(await readFile(join(res, "drawable/votic_splash_background.xml"), "utf8"), splash);
    assert.equal(await readFile(join(res, "mipmap-hdpi/ic_launcher_background.png"), "utf8"), "launcher artwork");
    const styles = await readFile(join(res, "values/styles.xml"), "utf8");
    assert.match(styles, /@drawable\/votic_splash_background/);
    const colors = await readFile(join(res, "values/colors.xml"), "utf8");
    assert.doesNotMatch(colors, /iconBackground/);
    assert.match(colors, /splashscreen_background/);
    await resources.configureLauncherBackground(res, true);
    assert.equal(await readFile(join(res, "values/styles.xml"), "utf8"), styles);
    assert.equal(await readFile(join(res, "values/colors.xml"), "utf8"), colors);
    // A new prebuild can regenerate the old files. The transformation must still work.
    await writeFile(join(res, "drawable/ic_launcher_background.xml"), splash);
    await writeFile(join(res, "values/styles.xml"), '<item name="android:windowBackground">@drawable/ic_launcher_background</item>');
    await resources.configureLauncherBackground(res, true);
    assert.match(await readFile(join(res, "values/styles.xml"), "utf8"), /@drawable\/votic_splash_background/);
  } finally { await rm(res, { recursive: true, force: true }); }
});

test("color-backed adaptive icons retain the background color they use", async () => {
  const res = await fixture();
  try {
    await resources.configureLauncherBackground(res, false);
    assert.match(await readFile(join(res, "values/colors.xml"), "utf8"), /name="iconBackground">#D6EAFD/);
  } finally { await rm(res, { recursive: true, force: true }); }
});

test("a missing splash template fails instead of silently producing a broken splash reference", async () => {
  const res = await fixture();
  try {
    await rm(join(res, "drawable/ic_launcher_background.xml"));
    await assert.rejects(resources.configureLauncherBackground(res, true), { code: "ENOENT" });
  } finally { await rm(res, { recursive: true, force: true }); }
});
