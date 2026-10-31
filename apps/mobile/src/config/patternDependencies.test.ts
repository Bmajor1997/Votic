import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const legacy = require("minimatch");
const modern = require("minimatch-modern");

describe("patched pattern dependencies", () => {
  it("keeps legacy callable matching, defaults and classes backed by patched upstream code", () => {
    expect(require("minimatch-modern/package.json").version).toBe("11.0.3");
    expect(legacy("src/example.ts", "src/**/*.ts")).toBe(true);
    expect(legacy("src/example.js", "src/**/*.ts")).toBe(false);
    expect(legacy(".env", "*")).toBe(false);
    expect(legacy.defaults({ dot: true })(".env", "*")).toBe(true);
    expect(legacy.defaults({ dot: true }).defaults({ nocase: true })(".ENV", ".env")).toBe(true);
    expect(new legacy.Minimatch("*.ts")).toBeInstanceOf(modern.Minimatch);
    expect(legacy.GLOBSTAR).toBe(modern.GLOBSTAR);
    expect(new legacy.Minimatch("**/*.{js,ts}").match("src/example.ts")).toBe(true);
    expect(legacy.match(["src/a.ts", "src/b.js"], "**/*.ts")).toEqual(["src/a.ts"]);
    expect(legacy.makeRe("**/*.ts").test("src/a.ts")).toBe(true);
  });

  it("supports native Node ESM named imports used by newer tooling", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import match, { minimatch, Minimatch, defaults, makeRe, GLOBSTAR } from 'minimatch';
      if (!match('a.ts', '*.ts') || !minimatch('a.ts', '*.ts')) throw Error('matching failed');
      if (!new Minimatch('*.ts').match('a.ts') || !defaults({dot:true})('.env', '*')) throw Error('API failed');
      if (!makeRe('*.ts').test('a.ts') || !GLOBSTAR) throw Error('missing exports');
      console.log('ok');
    `,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(output.trim()).toBe("ok");
  });

  it("keeps both Jest's legacy glob and Expo's patched glob walking the same fixture", async () => {
    const folder = mkdtempSync(join(tmpdir(), "votic-patterns-"));
    try {
      mkdirSync(join(folder, "src"));
      writeFileSync(join(folder, "src/a.ts"), "");
      writeFileSync(join(folder, "src/b.js"), "");
      const jestRequire = createRequire(require.resolve("jest-config"));
      const oldGlob = jestRequire("glob");
      const newGlob = require("glob");
      expect(jestRequire("glob/package.json").version).toBe("7.2.3");
      expect(require("glob/package.json").version).toBe("14.0.3");
      const oldGlobRequire = createRequire(jestRequire.resolve("glob"));
      expect(oldGlobRequire.resolve("minimatch")).toBe(require.resolve("minimatch"));
      const options = { cwd: folder, nodir: true };
      expect(oldGlob.sync("src/*.ts", options)).toEqual(["src/a.ts"]);
      expect(await newGlob.glob("src/*.ts", options)).toEqual(["src/a.ts"]);
      const controller = new AbortController();
      controller.abort();
      await expect(newGlob.glob("**/*", { ...options, signal: controller.signal })).rejects.toThrow();
      // The older glob is outside the affected >=9 range; its matcher must still resolve to the adapter.
      expect(dirname(oldGlobRequire.resolve("minimatch"))).toContain("minimatch-compat");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
