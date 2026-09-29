import { NoteType,SavedPassage } from "../documents/types";

export const NOTE_TYPES:{value:NoteType;label:string}[]=[
 {value:"note",label:"Note"},{value:"key-point",label:"Key Point"},{value:"question",label:"Question"},{value:"definition",label:"Definition"}
];
export function noteType(value?:NoteType){return value||"note";}
export function noteTypeLabel(value?:NoteType){return NOTE_TYPES.find(item=>item.value===noteType(value))?.label||"Note";}
export function automaticNoteTitle(passage:Pick<SavedPassage,"note"|"text"|"title">){
 const explicit=passage.title?.trim();if(explicit)return explicit;
 const source=passage.note.trim()||passage.text.trim();
 const first=source.split(/[.!?\n]/).map(value=>value.trim()).find(Boolean)||"Untitled note";
 return first.length>54?first.slice(0,51).trimEnd()+"…":first;
}
export function cleanTags(value:string){return [...new Set(value.split(",").map(tag=>tag.trim()).filter(Boolean).map(tag=>tag.slice(0,30)))].slice(0,8);}
