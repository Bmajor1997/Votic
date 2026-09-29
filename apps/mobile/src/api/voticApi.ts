import Constants from "expo-constants";

const DEFAULT_API_URL="http://localhost:4173";
const API_TIMEOUT_MS=20_000;
export function developmentApiUrl(constants:typeof Constants=Constants){
 const legacy=constants as typeof Constants&{expoGoConfig?:{debuggerHost?:string};manifest2?:{extra?:{expoClient?:{hostUri?:string}}}};
 const hostUri=constants.expoConfig?.hostUri||legacy.expoGoConfig?.debuggerHost||legacy.manifest2?.extra?.expoClient?.hostUri;
 const host=hostUri?.replace(/^https?:\/\//,"").split(":")[0];
 return host?`http://${host}:4173`:DEFAULT_API_URL;
}
export function voticApiUrl(){return (process.env.EXPO_PUBLIC_VOTIC_API_URL||developmentApiUrl()).replace(/\/$/,"")}

async function apiFetch(path:string,init:RequestInit,timeoutMs=API_TIMEOUT_MS){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{return await fetch(voticApiUrl()+path,{...init,signal:controller.signal});}
 catch(error){if(error instanceof Error&&error.name==="AbortError")throw new Error("Votic took too long to respond. Check your connection and try again.");throw new Error("Votic could not connect. Check your connection and try again.");}
 finally{clearTimeout(timer);}
}
async function responseJson(response:Response){return response.json().catch(()=>({})) as Promise<Record<string,unknown>>;}
function serverError(result:Record<string,unknown>,fallback:string){return typeof result.error==="string"&&result.error.trim()?result.error:fallback;}

export async function extractDocument(name:string,bytes:ArrayBuffer){
 const response=await apiFetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Votic-Filename":encodeURIComponent(name)},body:bytes},30_000);
 const result=await responseJson(response);
 if(!response.ok)throw new Error(serverError(result,"Votic could not read this document."));
 if(typeof result.text!=="string"||!result.text.trim())throw new Error("This document does not contain readable text.");
 return result.text;
}

export type VoticAnswer={answer:string;mode:string;sectionIndex:number|null;sectionTitle:string|null};
export async function askVotic(question:string,document?:{title:string;sections:{heading:string;text:string}[]}):Promise<VoticAnswer>{
 const response=await apiFetch("/api/help",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,document})});
 const result=await responseJson(response);
 if(!response.ok)throw new Error(serverError(result,"Votic could not answer right now."));
 if(typeof result.answer!=="string"||!result.answer.trim())throw new Error("Votic returned an empty answer.");
 return {answer:result.answer.trim(),mode:String(result.mode||"built-in"),sectionIndex:Number.isInteger(result.sectionIndex)?result.sectionIndex as number:null,sectionTitle:typeof result.sectionTitle==="string"?result.sectionTitle:null};
}
