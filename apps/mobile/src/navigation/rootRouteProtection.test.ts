import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = ts.createSourceFile(
  "layout.tsx",
  readFileSync(resolve(root, "app/_layout.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const screens: { name: string; guard: string }[] = [];
function visit(node: ts.Node, guard = "true") {
  if (ts.isJsxElement(node)) {
    const tag = node.openingElement.tagName.getText(source);
    const props = node.openingElement.attributes.properties;
    const condition = props.find((p) => ts.isJsxAttribute(p) && p.name.getText(source) === "guard");
    if (
      tag === "Stack.Protected" &&
      condition &&
      ts.isJsxAttribute(condition) &&
      condition.initializer &&
      ts.isJsxExpression(condition.initializer)
    )
      guard = condition.initializer.expression!.getText(source);
    node.children.forEach((child) => visit(child, guard));
    return;
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "Stack.Screen") {
    const p = node.attributes.properties.find(
      (p) => ts.isJsxAttribute(p) && p.name.getText(source) === "name",
    );
    if (p && ts.isJsxAttribute(p) && p.initializer && ts.isStringLiteral(p.initializer))
      screens.push({ name: p.initializer.text, guard });
  }
  ts.forEachChild(node, (n) => visit(n, guard));
}
visit(source);
const files = readdirSync(resolve(root, "app"))
  .filter((f) => f.endsWith(".tsx") && f !== "_layout.tsx")
  .map((f) => f.slice(0, -4));
const routeNames = [...new Set([...files, "(tabs)", "settings/[category]"])];
// Execute installed Expo Router's real auto-registration/filtering algorithm, not the app's router mock.
const router = readFileSync(resolve(root, "node_modules/expo-router/build/useScreens.js"), "utf8");
const algorithm = router.slice(
  router.indexOf("function getSortedChildren("),
  router.indexOf("function fromImport("),
);
function eligible(
  signedIn: boolean,
  personalized: boolean,
  subscribed: boolean,
  handedOff = subscribed,
  widgetsIntroduced = handedOff,
  planChosen = handedOff,
) {
  const state = {
    signedIn,
    personalized,
    subscribed,
    appReady: personalized && handedOff && planChosen,
    setup: { handedOff, widgetsIntroduced, planChosen },
  };
  const active = screens.filter((s) => vm.runInNewContext(s.guard, state));
  const protectedNames = new Set(screens.filter((s) => !active.includes(s)).map((s) => s.name));
  const ctx = {
    console,
    Route_1: {
      sortRoutesWithInitial: () => () => 0,
      useRouteNode: () => ({ children: routeNames.map((route) => ({ route })) }),
    },
    react_2: { default: { useMemo: (f: () => unknown) => f() } },
    routeToScreen: (r: { route: string }) => r.route,
  };
  return vm.runInNewContext(algorithm + "; useSortedScreens(order,protectedNames)", {
    ...ctx,
    order: active.map(({ name }) => ({ name })),
    protectedNames,
  }) as string[];
}
describe("filesystem route access using Expo Router", () => {
  it("classifies every route explicitly, so newly added files cannot silently bypass guards", () => {
    expect(routeNames.filter((name) => !screens.some((s) => s.name === name))).toEqual([]);
    expect(screens.filter((s) => s.guard === "true")).toEqual([]);
  });
  for (const state of [
    [false, false, false],
    [true, false, false],
    [true, true, false],
  ])
    it(`blocks app routes before onboarding is completed for ${state.join("/")}`, () => {
      const actual = eligible(...(state as [boolean, boolean, boolean]));
      for (const route of ["scan", "import-web", "pronunciations", "voices", "reader", "(tabs)"])
        expect(actual).not.toContain(route);
      // Backup and restore are linked from Account, which every signed-in stage can open.
      expect(actual.includes("library-backup")).toBe(state[0]);
    });
  it("places widgets and the ready recap before the Free app and paywall", () => {
    for (const subscribed of [false, true]) {
      const widgets = eligible(true, true, subscribed, false, false);
      expect(widgets).toContain("widgets-intro");
      expect(widgets).not.toContain("paywall");
      expect(widgets).not.toContain("(tabs)");
      const ready = eligible(true, true, subscribed, false, true);
      expect(ready).toContain("ready");
      expect(ready).not.toContain("paywall");
      expect(ready).not.toContain("(tabs)");
    }
    // app_stage sets the navigation guard from completed personalization for Free and Plus users.
    const completed = eligible(true, true, true, true, true);
    expect(completed).toContain("paywall");
    expect(completed).toContain("(tabs)");
    expect(completed).not.toContain("ready");
    expect(completed).not.toContain("widgets-intro");
  });
  it("allows app routes after setup and the explicit plan choice", () => {
    expect(eligible(true, true, true)).toEqual(
      expect.arrayContaining(["scan", "import-web", "pronunciations", "voices", "reader"]),
    );
  });
  it("keeps the final choice mandatory, while allowing Free users in after choosing", () => {
    const pending = eligible(true, true, false, true, true, false);
    expect(pending).toContain("paywall");
    expect(pending).toContain("library-backup");
    for (const route of ["(tabs)", "reader", "recently-deleted", "note-drafts", "widget", "handle-share"])
      expect(pending).not.toContain(route);
    const free = eligible(true, true, false, true, true, true);
    expect(free).toEqual(
      expect.arrayContaining(["(tabs)", "reader", "scan", "import-web", "library-backup"]),
    );
  });
});
