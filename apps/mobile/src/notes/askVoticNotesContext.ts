import { VoticDocument } from "../documents/types";

export type NotesAskScope={documentId?:string;passageId?:string;passageIds?:string[]};

export function notesForAskVotic(documents:VoticDocument[],scope:NotesAskScope){
  const selected=scope.documentId?documents.filter(document=>document.id===scope.documentId):documents;
  return selected.flatMap(document=>(document.savedPassages||[])
    .filter(passage=>!scope.passageId||passage.id===scope.passageId)
    .filter(passage=>!scope.passageIds?.length||scope.passageIds.includes(passage.id))
    .filter(passage=>Boolean(passage.note.trim()))
    .map(passage=>({document,passage})));
}

export function buildNotesAskDocument(documents:VoticDocument[],scope:NotesAskScope){
  const notes=notesForAskVotic(documents,scope);
  if(!notes.length)return undefined;
  const oneDocument=scope.documentId?notes[0]?.document:undefined;
  return {
    title:oneDocument?`Notes from ${oneDocument.title}`:"My Votic notes",
    sections:notes.map(({document,passage},index)=>({
      heading:`Note ${index+1} — ${document.title}`,
      text:`My note: ${passage.note.trim()}\nSource passage: ${passage.text}`
    }))
  };
}

export function notesAskScopeLabel(documents:VoticDocument[],scope:NotesAskScope){
  const notes=notesForAskVotic(documents,scope);
  if(!notes.length)return "";
  if(scope.passageId)return `Asking about: 1 note · ${notes[0].document.title}`;
  if(scope.passageIds?.length)return `Asking about: ${notes.length} selected ${notes.length===1?"note":"notes"}`;
  if(scope.documentId)return `Asking about: ${notes[0].document.title} · ${notes.length} ${notes.length===1?"note":"notes"}`;
  return `Asking about: All notes · ${notes.length} ${notes.length===1?"note":"notes"}`;
}
