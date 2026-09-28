import { PropsWithChildren,createContext,useContext,useEffect,useRef,useState } from "react";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

type TransitionContextValue={openReader:(navigate:()=>void)=>void;closeReader:(navigate:()=>void)=>void;transitioning:boolean};
const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {reduceMotion}=useAccessibilityPreferences();
  const [transitioning,setTransitioning]=useState(false);
  const opening=useRef(false);
  const unlockTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>()=>{if(unlockTimer.current)clearTimeout(unlockTimer.current);},[]);

  function unlock(){
    opening.current=false;
    setTransitioning(false);
    if(unlockTimer.current){clearTimeout(unlockTimer.current);unlockTimer.current=null;}
  }

  function openReader(navigate:()=>void){
    if(opening.current)return;
    opening.current=true;
    setTransitioning(true);
    navigate();
    unlockTimer.current=setTimeout(unlock,reduceMotion?150:520);
  }

  function closeReader(navigate:()=>void){
    unlock();
    navigate();
  }

  return <TransitionContext.Provider value={{openReader,closeReader,transitioning}}>{children}</TransitionContext.Provider>;
}

export function useDocumentTransition(){
  const value=useContext(TransitionContext);
  if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}
