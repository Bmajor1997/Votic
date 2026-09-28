import { createContext,PropsWithChildren,useContext,useEffect,useMemo,useState } from "react";
import { SavedPassage,VoticDocument } from "./types";
import { loadCollections,loadDocuments,saveCollections,saveDocuments } from "./documentStorage";

type Library={
  documents:VoticDocument[];
  collections:string[];
  activeDocument:VoticDocument|null;
  persistenceError:string|null;
  addTextDocument:(sourceName:string,text:string)=>VoticDocument;
  openDocument:(id:string,sentenceIndex?:number)=>void;
  addCollection:(name:string)=>void;
  setDocumentCollection:(id:string,collection?:string)=>void;
  removeDocument:(id:string)=>void;
  savePassage:(documentId:string,passage:SavedPassage)=>void;
  removePassage:(documentId:string,passageId:string)=>void;
  updateProgress:(id:string,progress:number,sentenceIndex?:number,wordIndex?:number)=>void;
  recordActivity:(id:string,readingSeconds:number,listeningSeconds:number)=>void;
  completeDocument:(id:string,sentenceIndex:number,wordIndex:number)=>void;
  updatePlaybackRate:(id:string,rate:number)=>void;
  updateReviewResponses:(id:string,responses:Record<string,string>)=>void;
};

const C=createContext<Library|null>(null);

function titleFrom(sourceName:string,text:string){
  const fileTitle=sourceName.replace(/\.(txt|md)$/i,"").trim();
  const first=text.split(/\r?\n/).map(value=>value.trim()).find(Boolean)?.replace(/^#+\s*/,"").slice(0,80);
  return fileTitle||first||"Untitled document";
}

export function DocumentLibraryProvider({children}:PropsWithChildren){
  const [documents,setDocuments]=useState<VoticDocument[]>([]);
  const [collections,setCollections]=useState<string[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [hydrated,setHydrated]=useState(false);
  const [persistenceError,setPersistenceError]=useState<string|null>(null);

  useEffect(()=>{
    let mounted=true;
    Promise.all([loadDocuments(),loadCollections()]).then(([savedDocuments,savedCollections])=>{
      if(!mounted)return;
      setDocuments(savedDocuments);
      setCollections(savedCollections);
      setActiveId(savedDocuments[0]?.id||null);
      setPersistenceError(null);
      setHydrated(true);
    }).catch(()=>{
      if(!mounted)return;
      setPersistenceError("Votic could not read its saved library. Your stored data has not been overwritten. Restart Votic and try again before making library changes.");
      setHydrated(false);
    });
    return()=>{mounted=false;};
  },[]);

  useEffect(()=>{if(hydrated)saveDocuments(documents).then(()=>setPersistenceError(null)).catch(()=>setPersistenceError("Votic could not save your library changes. Keep Votic open and try the change again."));},[documents,hydrated]);
  useEffect(()=>{if(hydrated)saveCollections(collections).then(()=>setPersistenceError(null)).catch(()=>setPersistenceError("Votic could not save your collection changes. Keep Votic open and try the change again."));},[collections,hydrated]);

  const activeDocument=useMemo(()=>documents.find(document=>document.id===activeId)||null,[documents,activeId]);

  function addTextDocument(sourceName:string,text:string){
    const now=Date.now();
    const document:VoticDocument={
      id:"doc-"+now+"-"+Math.random().toString(36).slice(2,8),
      title:titleFrom(sourceName,text),
      sourceName,
      plainText:text.trim(),
      importedAt:now,
      updatedAt:now,
      lastOpenedAt:now,
      progress:0,
      sentenceIndex:0,
      wordIndex:0,
      playbackRate:1,
      activity:{},
      savedPassages:[]
    };
    setDocuments(current=>[document,...current]);
    setActiveId(document.id);
    return document;
  }

  function openDocument(id:string,sentenceIndex?:number){
    setActiveId(id);
    setDocuments(current=>current.map(document=>document.id===id?{
      ...document,
      lastOpenedAt:Date.now(),
      sentenceIndex:sentenceIndex??document.sentenceIndex,
      wordIndex:sentenceIndex===undefined?document.wordIndex:0
    }:document));
  }

  function addCollection(name:string){
    const clean=name.trim();
    if(!clean)return;
    setCollections(current=>current.some(value=>value.toLocaleLowerCase()===clean.toLocaleLowerCase())?current:[...current,clean]);
  }

  function setDocumentCollection(id:string,collection?:string){
    setDocuments(current=>current.map(document=>document.id===id?{...document,collection:collection||undefined,updatedAt:Date.now()}:document));
  }

  function removeDocument(id:string){
    setDocuments(current=>current.filter(document=>document.id!==id));
    setActiveId(current=>current===id?null:current);
  }

  function savePassage(documentId:string,passage:SavedPassage){
    setDocuments(current=>current.map(document=>document.id===documentId?{
      ...document,
      savedPassages:[...(document.savedPassages||[]).filter(saved=>saved.id!==passage.id),passage],
      updatedAt:Date.now()
    }:document));
  }

  function removePassage(documentId:string,passageId:string){
    setDocuments(current=>current.map(document=>document.id===documentId?{
      ...document,
      savedPassages:(document.savedPassages||[]).filter(saved=>saved.id!==passageId),
      updatedAt:Date.now()
    }:document));
  }

  function updateProgress(id:string,progress:number,sentenceIndex=0,wordIndex=0){
    setDocuments(current=>current.map(document=>document.id===id?{
      ...document,
      progress:Math.max(0,Math.min(1,progress)),
      sentenceIndex,
      wordIndex,
      updatedAt:Date.now()
    }:document));
  }

  function updatePlaybackRate(id:string,rate:number){
    setDocuments(current=>current.map(document=>document.id===id?{...document,playbackRate:rate,updatedAt:Date.now()}:document));
  }

  function updateReviewResponses(id:string,responses:Record<string,string>){
    setDocuments(current=>current.map(document=>document.id===id?{...document,reviewResponses:responses,updatedAt:Date.now()}:document));
  }

  function recordActivity(id:string,readingSeconds:number,listeningSeconds:number){
    const now=new Date();
    const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
    setDocuments(current=>current.map(document=>{
      if(document.id!==id)return document;
      const previous=document.activity?.[day]||{readingSeconds:0,listeningSeconds:0};
      return {...document,activity:{...document.activity,[day]:{
        readingSeconds:previous.readingSeconds+readingSeconds,
        listeningSeconds:previous.listeningSeconds+listeningSeconds
      }}};
    }));
  }

  function completeDocument(id:string,sentenceIndex:number,wordIndex:number){
    const now=Date.now();
    setDocuments(current=>current.map(document=>document.id===id?{
      ...document,
      progress:1,
      sentenceIndex,
      wordIndex,
      completedAt:document.completedAt||now,
      updatedAt:now
    }:document));
  }

  return <C.Provider value={{
    documents,collections,activeDocument,persistenceError,addTextDocument,openDocument,addCollection,
    setDocumentCollection,removeDocument,savePassage,removePassage,updateProgress,recordActivity,
    completeDocument,updatePlaybackRate,updateReviewResponses
  }}>{children}</C.Provider>;
}

export function useDocumentLibrary(){
  const context=useContext(C);
  if(!context)throw new Error("useDocumentLibrary must be used inside DocumentLibraryProvider");
  return context;
}
