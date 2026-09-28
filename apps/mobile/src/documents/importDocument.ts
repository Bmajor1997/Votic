export type ImportCandidate={name:string;mimeType?:string|null;size?:number|null;uri:string};
export const MAX_DOCUMENT_BYTES=25_000_000;
export function supportedDocument(name:string){return /\.(txt|md|pdf|docx|pptx|ppt|epub)$/i.test(name)}
export function canReadLocally(name:string){return /\.(txt|md)$/i.test(name)}
export function validateImport(candidate:ImportCandidate){
 if(!candidate.name||candidate.name.length>255)throw new Error("Document filename is too long.");
 if(!supportedDocument(candidate.name))throw new Error("Choose a TXT, Markdown, PDF, Word, PowerPoint, or EPUB document.");
 if(typeof candidate.size==="number"&&(!Number.isFinite(candidate.size)||candidate.size<0))throw new Error("Votic could not determine this document's size.");
 if((candidate.size||0)>MAX_DOCUMENT_BYTES)throw new Error("Document is too large. The current limit is 25 MB.");
 return candidate;
}
export function validateLoadedBytes(byteLength:number){
 if(!Number.isSafeInteger(byteLength)||byteLength<0)throw new Error("Votic could not determine this document's size.");
 if(byteLength>MAX_DOCUMENT_BYTES)throw new Error("Document is too large. The current limit is 25 MB.");
}
