import AsyncStorage from "@react-native-async-storage/async-storage";
import { VoticDocument } from "./types";
const LEGACY_KEY="votic.mobile.documents.v1",COLLECTIONS_KEY="votic.mobile.collections.v1";
// Metadata changes constantly (progress, notes); document text almost never does, so they are stored apart.
export const LIBRARY_KEY="votic.mobile.library.v2";
const TEXT_KEY_PREFIX="votic.mobile.document-text.v1:";
export function documentTextKey(id:string){return TEXT_KEY_PREFIX+id;}

type StoredDocument=Omit<VoticDocument,"plainText">;
function metadata({plainText:_text,...document}:VoticDocument):StoredDocument{return document;}

function parseArray(raw:string|null,label:string){
 if(!raw)return [];
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw new Error(`Saved ${label} data could not be read.`);}
 if(!Array.isArray(value))throw new Error(`Saved ${label} data is invalid.`);
 return value;
}

/** Loads and saves the document library, rewriting a document's text only when it changes. */
export function createDocumentStore(){
 const persistedTexts=new Map<string,string>();

 async function migrateLegacyDocuments(){
  const value=parseArray(await AsyncStorage.getItem(LEGACY_KEY),"document");
  const documents=value.filter(valid);
  if(documents.length!==value.length)throw new Error("Some saved document data is invalid.");
  if(!documents.length)return [];
  // Texts first, then metadata, then drop the legacy copy, so an interrupted migration never loses data.
  await AsyncStorage.multiSet(documents.map(document=>[documentTextKey(document.id),document.plainText]));
  await AsyncStorage.setItem(LIBRARY_KEY,JSON.stringify(documents.map(metadata)));
  await AsyncStorage.removeItem(LEGACY_KEY);
  return documents;
 }

 async function loadDocuments():Promise<VoticDocument[]>{
  const raw=await AsyncStorage.getItem(LIBRARY_KEY);
  const documents=raw===null?await migrateLegacyDocuments():await loadSplitDocuments(raw);
  persistedTexts.clear();
  for(const document of documents)persistedTexts.set(document.id,document.plainText);
  return documents;
 }

 async function loadSplitDocuments(raw:string){
  const value=parseArray(raw,"document");
  if(!value.every(validMetadata))throw new Error("Some saved document data is invalid.");
  const texts=await AsyncStorage.multiGet(value.map(document=>documentTextKey(document.id)));
  const documents=value.map((document,index)=>{
   const text=texts[index]?.[1];
   if(typeof text!=="string")throw new Error("Saved document text could not be read.");
   return {...document,plainText:text} as VoticDocument;
  });
  void AsyncStorage.removeItem(LEGACY_KEY).catch(()=>{});
  return documents;
 }

 async function saveDocuments(documents:VoticDocument[]){
  // Text is written before the metadata that references it, and removed only after.
  const changed=documents.filter(document=>persistedTexts.get(document.id)!==document.plainText);
  if(changed.length){
   await AsyncStorage.multiSet(changed.map(document=>[documentTextKey(document.id),document.plainText]));
   for(const document of changed)persistedTexts.set(document.id,document.plainText);
  }
  await AsyncStorage.setItem(LIBRARY_KEY,JSON.stringify(documents.map(metadata)));
  const ids=new Set(documents.map(document=>document.id));
  const removed=[...persistedTexts.keys()].filter(id=>!ids.has(id));
  if(removed.length){
   await AsyncStorage.multiRemove(removed.map(documentTextKey));
   for(const id of removed)persistedTexts.delete(id);
  }
 }

 return {loadDocuments,saveDocuments};
}

export async function loadCollections():Promise<string[]>{
 const value=parseArray(await AsyncStorage.getItem(COLLECTIONS_KEY),"collection");
 if(value.some(item=>typeof item!=="string"))throw new Error("Some saved collection data is invalid.");
 return value.map(item=>(item as string).trim()).filter(Boolean);
}
export async function saveCollections(collections:string[]){await AsyncStorage.setItem(COLLECTIONS_KEY,JSON.stringify(collections));}
function validMetadata(value:any):value is StoredDocument{return value&&typeof value.id==="string"&&typeof value.title==="string"&&typeof value.progress==="number"&&Number.isInteger(value.sentenceIndex)&&Number.isInteger(value.wordIndex);}
function valid(value:any):value is VoticDocument{return validMetadata(value)&&typeof (value as any).plainText==="string";}
