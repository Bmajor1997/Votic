import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import verifier from "../security/verify-gitleaks-log.cjs";

test("secret scan verifier accepts real colored output and rejects empty or broken scans", () => {
  const esc = String.fromCharCode(27);
  const colored = `${esc}[90m6:37PM${esc}[0m ${esc}[32mINF${esc}[0m ${esc}[1m569 commits scanned.${esc}[0m\n${esc}[1mno leaks found${esc}[0m`;
  assert.doesNotThrow(() => verifier.verify_gitleaks_log(colored));
  assert.doesNotThrow(() => verifier.verify_gitleaks_log("1 commit scanned.\nno leaks found"));
  for (const log of ["", "no leaks found", "0 commits scanned.\nno leaks found", "569 commits scanned.", "1 commits scanned.\n0 commits scanned.\nno leaks found", `${colored}\ncommand aborted: exit status 128`, `${colored}\nfatal: unknown revision`, `${colored}\nERR scan failed`]) {
    assert.throws(() => verifier.verify_gitleaks_log(log));
  }
});

for (const scenario of ["retry", "failed", "incomplete", "installed"]) {
  test(`Android NDK installation validates the toolchain and handles ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), "votic-ci-"));
    const sdk = join(root, "Android SDK");
    const bin = join(root, "bin");
    const ndk = join(sdk, "ndk", "27.1.12297006");
    try {
      mkdirSync(bin, { recursive: true });
      mkdirSync(join(sdk, "ndk", "other-version"), { recursive: true });
      writeFileSync(join(sdk, "ndk", "other-version", "keep"), "untouched");
      writeFileSync(join(bin, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
      writeFileSync(join(bin, "sdkmanager"), `#!/usr/bin/env bash
set -eu
test "$1" = "--sdk_root=$ANDROID_HOME"
test "$2" = "--install"
test "$3" = "ndk;27.1.12297006"
count_file="$ANDROID_HOME/attempts"
count=0
if test -f "$count_file"; then count=$(cat "$count_file"); fi
count=$((count + 1))
echo "$count" > "$count_file"
mkdir -p "$ANDROID_HOME/ndk/27.1.12297006"
if test "$NDK_SCENARIO" = "failed"; then exit 1; fi
if test "$NDK_SCENARIO" = "incomplete"; then exit 0; fi
if test "$count" -lt 2; then exit 1; fi
mkdir -p "$ANDROID_HOME/ndk/27.1.12297006/build/cmake"
echo 'Pkg.Revision = 27.1.12297006' > "$ANDROID_HOME/ndk/27.1.12297006/source.properties"
touch "$ANDROID_HOME/ndk/27.1.12297006/build/cmake/android.toolchain.cmake"
`, { mode: 0o755 });
      if (scenario === "installed") {
        mkdirSync(join(ndk, "build", "cmake"), { recursive: true });
        writeFileSync(join(ndk, "source.properties"), "Pkg.Revision = 27.1.12297006\n");
        writeFileSync(join(ndk, "build", "cmake", "android.toolchain.cmake"), "");
      }
      const result = spawnSync("bash", [resolve("security/install-android-ndk.sh")], {
        env: { ...process.env, ANDROID_HOME: sdk, NDK_SCENARIO: scenario, PATH: `${bin}:${process.env.PATH}` },
        encoding: "utf8",
      });
      assert.equal(result.status, ["retry", "installed"].includes(scenario) ? 0 : 1, result.stderr);
      const attempts = join(sdk, "attempts");
      if (scenario === "installed") assert.equal(existsSync(attempts), false);
      else assert.equal(Number(readFileSync(attempts, "utf8")), scenario === "retry" ? 2 : 3);
      assert.equal(readFileSync(join(sdk, "ndk", "other-version", "keep"), "utf8"), "untouched");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
