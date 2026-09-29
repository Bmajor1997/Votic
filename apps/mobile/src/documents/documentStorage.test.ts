import { beforeEach,describe,expect,it,vi } from "vitest";
import { VoticDocument } from "./types";

const memory=vi.hoisted(()=>new Map<string,string>());
vi.mock("@react-native-async-storage/async-storage",()=>({default:{
 getItem:vi.fn(async(key:string)=>memory.get(key)??null),
 setItem:vi.fn(async(key:string,value:string)=>{memory.set(key,value);}),
 removeItem:vi.fn(async(key:string)=>{memory.delete(key);}),
 multiGet:vi.fn(async(keys:string[])=>keys.map(key=>[key,memory.get(key)??null])),
 multiSet:vi.fn(async(pairs:[string,string][])=>{for(const [key,value] of pairs)memory.set(key,value);}),
 multiRemove:vi.fn(async(keys:string[])=>{for(const key of keys)memory.delete(key);})
}}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createDocumentStore,documentTextKey,LIBRARY_KEY } from "./documentStorage";

const LEGACY_KEY="votic.mobile.documents.v1";
function doc(id:string,plainText:string,extra:Partial<VoticDocument>={}):VoticDocument{
 return {id,title:id,sourceName:id+".txt",plainText,importedAt:1,updatedAt:1,progress:0,sentenceIndex:0,wordIndex:0,playbackRate:1,savedPassages:[],...extra};
}

beforeEach(()=>{memory.clear();vi.clearAllMocks();});

describe("document storage",()=>{
 it("stores metadata without document text, and each text under its own key",async()=>{
  const store=createDocumentStore();await store.loadDocuments();
  await store.saveDocuments([doc("a","Alpha text."),doc("b","Beta text.")]);
  expect(memory.get(LIBRARY_KEY)).not.toContain("Alpha text.");
  expect(memory.get(documentTextKey("a"))).toBe("Alpha text.");
  expect(memory.get(documentTextKey("b"))).toBe("Beta text.");
 });
 it("round-trips the full library",async()=>{
  const library=[doc("a","Alpha text.",{progress:.4,sentenceIndex:3,wordIndex:2,savedPassages:[{id:"passage-3",sentenceIndex:3,text:"Alpha text.",note:"n",createdAt:1,updatedAt:1}]})];
  await createDocumentStore().saveDocuments(library);
  expect(await createDocumentStore().loadDocuments()).toEqual(library);
 });
 it("does not rewrite document text when only reading progress changes",async()=>{
  const bigText="word ".repeat(100_000);
  const store=createDocumentStore();await store.loadDocuments();
  await store.saveDocuments([doc("a",bigText)]);
  vi.mocked(AsyncStorage.multiSet).mockClear();vi.mocked(AsyncStorage.setItem).mockClear();
  for(let word=1;word<=20;word+=1)await store.saveDocuments([doc("a",bigText,{wordIndex:word,progress:word/1000})]);
  expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  const writes=vi.mocked(AsyncStorage.setItem).mock.calls;
  expect(writes.every(([key,value])=>key===LIBRARY_KEY&&value.length<1000)).toBe(true);
 });
 it("does not rewrite text that was just loaded",async()=>{
  await createDocumentStore().saveDocuments([doc("a","Alpha text.")]);
  const store=createDocumentStore();const loaded=await store.loadDocuments();
  vi.mocked(AsyncStorage.multiSet).mockClear();
  await store.saveDocuments([{...loaded[0],progress:.5}]);
  expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
 });
 it("writes text for newly added documents only",async()=>{
  const store=createDocumentStore();await store.loadDocuments();
  await store.saveDocuments([doc("a","Alpha text.")]);
  vi.mocked(AsyncStorage.multiSet).mockClear();
  await store.saveDocuments([doc("b","Beta text."),doc("a","Alpha text.")]);
  expect(AsyncStorage.multiSet).toHaveBeenCalledWith([[documentTextKey("b"),"Beta text."]]);
 });
 it("deletes the text of removed documents",async()=>{
  const store=createDocumentStore();await store.loadDocuments();
  await store.saveDocuments([doc("a","Alpha text."),doc("b","Beta text.")]);
  await store.saveDocuments([doc("b","Beta text.")]);
  expect(memory.has(documentTextKey("a"))).toBe(false);
  expect(memory.get(documentTextKey("b"))).toBe("Beta text.");
 });
 it("migrates a v1 library to split storage and removes the legacy copy",async()=>{
  const legacy=[doc("a","Alpha text.",{progress:.25,sentenceIndex:4}),doc("b","Beta text.")];
  memory.set(LEGACY_KEY,JSON.stringify(legacy));
  expect(await createDocumentStore().loadDocuments()).toEqual(legacy);
  expect(memory.has(LEGACY_KEY)).toBe(false);
  expect(memory.get(documentTextKey("a"))).toBe("Alpha text.");
  expect(await createDocumentStore().loadDocuments()).toEqual(legacy);
 });
 it("keeps the legacy copy if migration is interrupted",async()=>{
  memory.set(LEGACY_KEY,JSON.stringify([doc("a","Alpha text.")]));
  vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));
  await expect(createDocumentStore().loadDocuments()).rejects.toThrow("disk full");
  expect(memory.has(LEGACY_KEY)).toBe(true);
  expect(memory.has(LIBRARY_KEY)).toBe(false);
 });
 it("starts empty when nothing is saved",async()=>{
  expect(await createDocumentStore().loadDocuments()).toEqual([]);
 });
 it("fails instead of loading an empty library when saved data is corrupt",async()=>{
  memory.set(LIBRARY_KEY,"{not json");
  await expect(createDocumentStore().loadDocuments()).rejects.toThrow(/could not be read/);
 });
 it("fails instead of dropping a document whose text is missing",async()=>{
  await createDocumentStore().saveDocuments([doc("a","Alpha text.")]);
  memory.delete(documentTextKey("a"));
  await expect(createDocumentStore().loadDocuments()).rejects.toThrow(/text could not be read/);
 });
});
