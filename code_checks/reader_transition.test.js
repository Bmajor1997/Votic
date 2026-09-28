import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provider=fs.readFileSync("apps/mobile/src/navigation/DocumentTransitionProvider.tsx","utf8");
const layout=fs.readFileSync("apps/mobile/app/_layout.tsx","utf8");
const reader=fs.readFileSync("apps/mobile/app/reader.tsx","utf8");

test("Reader transition has no temporary flash overlay",()=>{
  assert.doesNotMatch(provider,/focusOpacity|styles\.focus|Animated\.View/);
  assert.doesNotMatch(provider,/backgroundColor:\s*["']#000["']/);
});

test("Reader route leaves the source screen mounted and disables competing stack animation",()=>{
  assert.match(layout,/name="reader"[\s\S]*animation:"none"/);
  assert.match(layout,/name="reader"[\s\S]*presentation:"transparentModal"/);
  assert.match(layout,/name="reader"[\s\S]*backgroundColor:"transparent"/);
});

test("Reader container owns a reversible zoom transition",()=>{
  assert.match(reader,/duration:380/);
  assert.match(reader,/duration:320/);
  assert.match(reader,/transform:\[\{scale:entrance\.interpolate/);
  assert.match(reader,/outputRange:\[\.985,1\]/);
  assert.match(reader,/async function closeReader\(\)/);
  assert.doesNotMatch(reader,/translateY:entrance\.interpolate/);
});
