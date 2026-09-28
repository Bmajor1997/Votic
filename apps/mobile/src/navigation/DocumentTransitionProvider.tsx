import { PropsWithChildren,createContext,useContext,useMemo,useRef,useState } from "react";
import { Animated } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

export type DocumentSourceRect={x:number;y:number;width:number;height:number};
type TransitionContextValue={openReader:(source:DocumentSourceRect,navigate:()=>void)=>void;beginReader:()=>void;closeReader:(navigate:()=>void)=>void;sourceRect:DocumentSourceRect|null;progress:Animated.Value;transitioning:boolean};
const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {reduceMotion}=useAccessibilityPreferences();
  const [sourceRect,setSourceRect]=useState<DocumentSourceRect|null>(null);
  const [transitioning,setTransitioning]=useState(false);
  const locked=useRef(false);
  const progress=useRef(new Animated.Value(0)).current;

  function openReader(source:DocumentSourceRect,navigate:()=>void){
    if(locked.current)return;
    locked.current=true;
    progress.stopAnimation();
    progress.setValue(reduceMotion?1:0);
    setSourceRect(source);
    setTransitioning(true);
    navigate();
  }

  function beginReader(){
    if(reduceMotion){progress.setValue(1);locked.current=false;setTransitioning(false);return;}
    Animated.timing(progress,{toValue:1,duration:300,useNativeDriver:true}).start(({finished})=>{if(finished){locked.current=false;setTransitioning(false);}});
  }
  function closeReader(navigate:()=>void){
    if(locked.current)return;
    locked.current=true;
    setTransitioning(true);
    if(reduceMotion){progress.setValue(0);locked.current=false;setTransitioning(false);navigate();return;}
    Animated.timing(progress,{toValue:0,duration:240,useNativeDriver:true}).start(()=>{locked.current=false;setTransitioning(false);navigate();});
  }

  const value=useMemo(()=>({openReader,beginReader,closeReader,sourceRect,progress,transitioning}),[sourceRect,transitioning,reduceMotion]);
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

export function useDocumentTransition(){
  const value=useContext(TransitionContext);
  if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}
