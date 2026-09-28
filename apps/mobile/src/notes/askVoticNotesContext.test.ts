import { buildNotesAskDocument,notesAskScopeLabel } from "./askVoticNotesContext";
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
  expect(context?.sections).toHaveLength(1);
  expect(context?.sections[0].text).toContain("Chunking can reduce memory load.");
  expect(context?.sections[0].text).toContain("Working memory is limited.");
 });
 it("can scope Ask Votic to one note",()=>{
  const context=buildNotesAskDocument(documents,{documentId:"doc-1",passageId:"p1"});
  expect(context?.sections).toHaveLength(1);
  expect(notesAskScopeLabel(documents,{documentId:"doc-1",passageId:"p1"})).toBe("Asking about: 1 note · Psychology");
 });
 it("does not send saved passages without a user note as notes context",()=>{
  expect(buildNotesAskDocument(documents,{documentId:"doc-1",passageId:"p2"})).toBeUndefined();
 });
});
