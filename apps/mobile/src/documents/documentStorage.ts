import AsyncStorage from "@react-native-async-storage/async-storage";
import { VoticDocument } from "./types";
const KEY="votic.mobile.documents.v1",COLLECTIONS_KEY="votic.mobile.collections.v1";

function parseArray(raw:string|null,label:string){
 if(!raw)return [];
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw new Error(`Saved ${label} data could not be read.`);}
 if(!Array.isArray(value))throw new Error(`Saved ${label} data is invalid.`);
 return value;
}
export async function loadDocuments():Promise<VoticDocument[]>{
 const value=parseArray(await AsyncStorage.getItem(KEY),"document");
 const documents=value.filter(valid);
 if(documents.length!==value.length)throw new Error("Some saved document data is invalid.");
 return documents;
}
export async function saveDocuments(documents:VoticDocument[]){await AsyncStorage.setItem(KEY,JSON.stringify(documents));}
export async function loadCollections():Promise<string[]>{
 const value=parseArray(await AsyncStorage.getItem(COLLECTIONS_KEY),"collection");
 if(value.some(item=>typeof item!=="string"))throw new Error("Some saved collection data is invalid.");
 return value.map(item=>(item as string).trim()).filter(Boolean);
}
export async function saveCollections(collections:string[]){await AsyncStorage.setItem(COLLECTIONS_KEY,JSON.stringify(collections));}
function valid(value:any):value is VoticDocument{return value&&typeof value.id==="string"&&typeof value.title==="string"&&typeof value.plainText==="string"&&typeof value.progress==="number"&&Number.isInteger(value.sentenceIndex)&&Number.isInteger(value.wordIndex);}
