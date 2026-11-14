import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const merge = require("../apps/mobile/vendor/deepmerge/index.cjs");
const payload = () => JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}},"prototype":{"isAdmin":true},"safe":{"value":1}}');

function assert_safe(result) {
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.isAdmin, undefined);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    assert.equal(Object.hasOwn(result, key), false);
  }
  assert.equal({}.isAdmin, undefined);
}

test("vendored merge blocks prototype poisoning in both source and target, including nested placeholders", () => {
  for (const target of [{}, Object.create(null), payload()]) {
    const result = merge(target, payload());
    assert_safe(result);
    assert.deepEqual(result.safe, { value: 1 });
    assert_safe(merge(payload(), {}));
    for (const placeholder of [null, undefined, 0, false, ""]) {
      assert_safe(merge({ session: placeholder }, { session: payload() }).session);
    }
    assert_safe(merge({ session: target }, { session: payload() }).session);
    assert_safe(merge([], [payload()])[0]);
  }
});

test("vendored merge preserves Expo/Jest object, array, symbol and custom-merge semantics", () => {
  const symbol = Symbol("config");
  const target = { nested: { a: 1 }, list: [{ a: 1 }], [symbol]: { a: 1 } };
  const source = { nested: { b: 2 }, list: [{ b: 2 }], [symbol]: { b: 2 } };
  const result = merge(target, source);
  assert.deepEqual(result, { nested: { a: 1, b: 2 }, list: [{ a: 1 }, { b: 2 }], [symbol]: { a: 1, b: 2 } });
  assert.notEqual(result.list[0], target.list[0]);
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_target, value) => value }), { list: [2] });
  assert.deepEqual(merge({ nested: { a: 1 } }, { nested: { b: 2 } }, { customMerge: () => (_a, b) => b }), { nested: { b: 2 } });
  assert.equal(merge({}, { target }, { clone: false }).target, target);
  const date = new Date();
  assert.equal(merge({}, { date }).date, date);
});

test("vendored merge rejects a property when target membership inspection throws", () => {
  const target = new Proxy({}, { has() { throw new Error("untrusted target"); } });
  assert.deepEqual(merge(target, { injected: true }), {});
});
