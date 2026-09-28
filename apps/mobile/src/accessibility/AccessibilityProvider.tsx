import { createContext,PropsWithChildren,useContext,useEffect,useState } from "react";
import { AccessibilityInfo } from "react-native";
import { loadAccessibilityPreferences,saveAccessibilityPreferences } from "../preferences/preferenceStorage";

export type TextSize="default"|"large"|"extra-large";
export type ReadingSpacing="compact"|"default"|"extra";
export type ReaderFont="system"|"serif"|"accessible";
export type TextSpacing="default"|"wide";
export type HighlightMode="off"|"sentence"|"word"|"both";

type AccessibilityPreferences={
  textSize:TextSize;
  setTextSize:(value:TextSize)=>void;
  readingSpacing:ReadingSpacing;
  setReadingSpacing:(value:ReadingSpacing)=>void;
  readerFont:ReaderFont;
  setReaderFont:(value:ReaderFont)=>void;
  textSpacing:TextSpacing;
  setTextSpacing:(value:TextSpacing)=>void;
  highlightMode:HighlightMode;
  setHighlightMode:(value:HighlightMode)=>void;
  voiceIdentifier:string|null;
  setVoiceIdentifier:(value:string|null)=>void;
  reduceMotion:boolean;
  setReduceMotion:(value:boolean)=>void;
  wordEmphasis:boolean;
  setWordEmphasis:(value:boolean)=>void;
};

const AccessibilityContext=createContext<AccessibilityPreferences|null>(null);

export function AccessibilityProvider({children}:PropsWithChildren){
  const [textSize,setTextSize]=useState<TextSize>("default");
  const [readingSpacing,setReadingSpacing]=useState<ReadingSpacing>("default");
  const [readerFont,setReaderFont]=useState<ReaderFont>("system");
  const [textSpacing,setTextSpacing]=useState<TextSpacing>("default");
  const [highlightMode,setHighlightMode]=useState<HighlightMode>("both");
  const [voiceIdentifier,setVoiceIdentifier]=useState<string|null>(null);
  const [reduceMotionPreference,setReduceMotionPreference]=useState(false);
  const [systemReduceMotion,setSystemReduceMotion]=useState(false);
  const reduceMotion=reduceMotionPreference||systemReduceMotion;
  const setReduceMotion=setReduceMotionPreference;
  const [wordEmphasis,setWordEmphasis]=useState(true);
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    loadAccessibilityPreferences().then(saved=>{
      if(["default","large","extra-large"].includes(saved?.textSize))setTextSize(saved.textSize);
      if(["compact","default","extra"].includes(saved?.readingSpacing))setReadingSpacing(saved.readingSpacing);
      if(["system","serif","accessible"].includes(saved?.readerFont))setReaderFont(saved.readerFont);
      if(["default","wide"].includes(saved?.textSpacing))setTextSpacing(saved.textSpacing);
      if(["off","sentence","word","both"].includes(saved?.highlightMode))setHighlightMode(saved.highlightMode);
      if(typeof saved?.voiceIdentifier==="string")setVoiceIdentifier(saved.voiceIdentifier);
      if(typeof saved?.reduceMotion==="boolean")setReduceMotionPreference(saved.reduceMotion);
      if(typeof saved?.wordEmphasis==="boolean")setWordEmphasis(saved.wordEmphasis);
      setHydrated(true);
    });
  },[]);

  useEffect(()=>{
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion).catch(()=>{});
    const subscription=AccessibilityInfo.addEventListener("reduceMotionChanged",setSystemReduceMotion);
    return()=>subscription.remove();
  },[]);

  useEffect(()=>{
    if(hydrated)saveAccessibilityPreferences({textSize,readingSpacing,readerFont,textSpacing,highlightMode,voiceIdentifier,reduceMotion:reduceMotionPreference,wordEmphasis}).catch(()=>{});
  },[textSize,readingSpacing,readerFont,textSpacing,highlightMode,voiceIdentifier,reduceMotionPreference,wordEmphasis,hydrated]);

  return <AccessibilityContext.Provider value={{textSize,setTextSize,readingSpacing,setReadingSpacing,readerFont,setReaderFont,textSpacing,setTextSpacing,highlightMode,setHighlightMode,voiceIdentifier,setVoiceIdentifier,reduceMotion,setReduceMotion,wordEmphasis,setWordEmphasis}}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibilityPreferences(){
  const context=useContext(AccessibilityContext);
  if(!context)throw new Error("useAccessibilityPreferences must be used inside AccessibilityProvider");
  return context;
}
