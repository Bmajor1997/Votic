import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("Reader transition is driven by measured source-card geometry",()=>{
  const provider=read("apps/mobile/src/navigation/DocumentTransitionProvider.tsx");
  const reader=read("apps/mobile/app/reader.tsx");
  const documents=read("apps/mobile/app/(tabs)/documents.tsx");
  assert.match(provider,/DocumentSourceRect/);
  assert.match(documents,/measureInWindow/);
  assert.match(reader,/sourceScaleX/);
  assert.match(reader,/transition\.progress\.interpolate/);
  assert.doesNotMatch(reader,/outputRange:\[\.985,1\]/);
});

test("Ask Votic retains the failed question and exposes an in-flight retry state",()=>{
  const assistant=read("apps/mobile/app/assistant.tsx");
  assert.match(assistant,/lastQuestion\.current=clean/);
  assert.match(assistant,/send\(lastQuestion\.current\)/);
  assert.match(assistant,/Trying again…/);
  assert.match(assistant,/disabled=\{sending\}/);
});

test("top-edge fading is scroll-position based and honors Reduce Motion",()=>{
  const screen=read("apps/mobile/src/components/Screen.tsx");
  assert.match(screen,/ScrollFadeItem/);
  assert.match(screen,/contentOffset:\{y:scrollY\}/);
  assert.match(screen,/enabled:!reduceMotion/);
  assert.doesNotMatch(screen,/pointerEvents="none"/);
});

test("Notes are grouped by document and remain editable",()=>{
  const notes=read("apps/mobile/app/(tabs)/notes.tsx");
  assert.match(notes,/documents\.map\(document=>/);
  assert.match(notes,/noteCount/);
  assert.match(notes,/savePassage\(editing\.document\.id/);
  assert.match(notes,/Add a note/);
  assert.match(notes,/setViewing\(\{document,passage\}\)/);
  assert.match(notes,/Note options/);
  assert.match(notes,/Open in Reader/);
  assert.match(notes,/Remove from Notes/);
  assert.match(notes,/Alert\.alert\("Remove from Notes\?"/);
});
