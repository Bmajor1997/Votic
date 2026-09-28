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

test("Reader container owns a reversible source-geometry transition",()=>{
  assert.match(provider,/duration:420/);
  assert.match(provider,/duration:340/);
  assert.match(reader,/source\.width\/window\.width/);
  assert.match(reader,/source\.x\+source\.width\/2-window\.width\/2/);
  assert.match(reader,/scaleX:transition\.progress\.interpolate/);
  assert.match(reader,/scaleY:transition\.progress\.interpolate/);
  assert.match(reader,/readerReady/);
  assert.match(reader,/async function closeReader\(\)/);
  assert.doesNotMatch(reader,/outputRange:\[\.985,1\]/);
});
