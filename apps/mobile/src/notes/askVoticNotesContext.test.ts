import { describe,expect,it } from "vitest";
import { buildNotesAskDocument,noteSelectionKey,notesAskScopeLabel,notesForAskVotic } from "./askVoticNotesContext";
import { VoticDocument } from "../documents/types";

const documents:VoticDocument[]=[{
 id:"doc-1",title:"Psychology",sourceName:"psychology.pdf",plainText:"",importedAt:1,updatedAt:1,progress:0,sentenceIndex:0,wordIndex:0,playbackRate:1,
 savedPassages:[
  {id:"p1",sentenceIndex:4,text:"Working memory is limited.",note:"Chunking can reduce memory load.",createdAt:1,updatedAt:2},
  {id:"p2",sentenceIndex:8,text:"A saved quote.",note:"",createdAt:1,updatedAt:3}
 ]
}];

describe("Ask Votic notes context",()=>{
 it("includes written notes and their source passage",()=>{
  const context=buildNotesAskDocument(documents,{documentId:"doc-1"});
  expect(context?.title).toBe("Notes from Psychology");
  expect(context?.sections).toHaveLength(2);
  expect(context?.sections[0].text).toContain("Chunking can reduce memory load.");
  expect(context?.sections[0].text).toContain("Working memory is limited.");
 });
 it("can scope Ask Votic to one note",()=>{
  const context=buildNotesAskDocument(documents,{documentId:"doc-1",passageId:"p1"});
  expect(context?.sections).toHaveLength(1);
  expect(notesAskScopeLabel(documents,{documentId:"doc-1",passageId:"p1"})).toBe("Asking about: 1 note · Psychology");
 });
 it("includes saved passages without a user note, labelled with their source document and location",()=>{
  const context=buildNotesAskDocument(documents,{documentId:"doc-1",passageId:"p2"});
  expect(context?.sections).toEqual([{heading:"Saved passage 1 — Psychology",text:"Saved passage: A saved quote.\nLocation: passage 9 of Psychology"}]);
 });
 it("sends every note and saved passage in a notebook",()=>{
  const context=buildNotesAskDocument(documents,{documentId:"doc-1"});
  expect(context?.sections.map(section=>section.heading)).toEqual(["Note 1 — Psychology","Saved passage 2 — Psychology"]);
  expect(context?.sections[0].text).toContain("Location: passage 5 of Psychology");
 });
 it("skips saved passages with no text at all",()=>{
  const empty:VoticDocument[]=[{...documents[0],savedPassages:[{id:"blank",sentenceIndex:0,text:"  ",note:"",createdAt:1,updatedAt:1}]}];
  expect(buildNotesAskDocument(empty,{documentId:"doc-1"})).toBeUndefined();
 });
});

describe("multi-select notes scope",()=>{
 // Reader saves passages as "passage-<sentence>", so the same id exists in different documents.
 const twoDocuments:VoticDocument[]=[
  {...documents[0],id:"doc-a",title:"Biology",savedPassages:[{id:"passage-3",sentenceIndex:3,text:"Cells divide.",note:"Mitosis",createdAt:1,updatedAt:1}]},
  {...documents[0],id:"doc-b",title:"History",savedPassages:[{id:"passage-3",sentenceIndex:3,text:"Rome fell.",note:"",createdAt:1,updatedAt:1}]}
 ];
 it("selects a passage in one document without also selecting the same passage id in another",()=>{
  const items=notesForAskVotic(twoDocuments,{passageIds:[noteSelectionKey("doc-b","passage-3")]});
  expect(items.map(item=>item.document.id)).toEqual(["doc-b"]);
  expect(buildNotesAskDocument(twoDocuments,{passageIds:[noteSelectionKey("doc-b","passage-3")]})?.sections[0].text).toContain("Rome fell.");
 });
 it("combines selections across documents and keeps each source title",()=>{
  const context=buildNotesAskDocument(twoDocuments,{passageIds:[noteSelectionKey("doc-a","passage-3"),noteSelectionKey("doc-b","passage-3")]});
  expect(context?.title).toBe("My Votic notes");
  expect(context?.sections.map(section=>section.heading)).toEqual(["Note 1 — Biology","Saved passage 2 — History"]);
 });
});
