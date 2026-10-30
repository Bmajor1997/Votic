import assert from "node:assert/strict";
import { test } from "node:test";
import localStorage from "../apps/mobile/plugins/withLocalLibraryStorage.js";

test("Android library storage raises the small default ceiling without duplicating properties or changing other build settings", () => {
  const unrelated = { type: "property", key: "android.useAndroidX", value: "true" };
  const input = [unrelated, { type: "property", key: "AsyncStorage_db_size_in_MB", value: "6" }];
  const result = localStorage.configureProperties(input);
  assert.equal(result.find((entry) => entry.key === "AsyncStorage_db_size_in_MB").value, "128");
  assert.deepEqual(result[0], unrelated);
  assert.deepEqual(localStorage.configureProperties(result), result);
  assert.equal(input[1].value, "6");
});
