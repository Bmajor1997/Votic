import { PropsWithChildren,createContext,useContext,useEffect,useRef,useState } from "react";
import { Animated,StyleSheet } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

type TransitionContextValue={openReader:(navigate:()=>void)=>void;closeReader:(navigate:()=>void)=>void;transitioning:boolean};
const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {reduceMotion}=useAccessibilityPreferences();
  const [transitioning,setTransitioning]=useState(false);
  const opening=useRef(false);
  const focusOpacity=useRef(new Animated.Value(0)).current;
  const unlockTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(unlockTimer.current)clearTimeout(unlockTimer.current);focusOpacity.stopAnimation();},[focusOpacity]);
  function unlock(){opening.current=false;setTransitioning(false);if(unlockTimer.current){clearTimeout(unlockTimer.current);unlockTimer.current=null;}}
  function openReader(navigate:()=>void){
    if(opening.current)return;
    opening.current=true;setTransitioning(true);
    if(reduceMotion){navigate();unlockTimer.current=setTimeout(unlock,250);return;}
    focusOpacity.setValue(0);
    Animated.timing(focusOpacity,{toValue:.05,duration:70,useNativeDriver:true}).start(()=>{
      navigate();
      Animated.timing(focusOpacity,{toValue:0,duration:190,useNativeDriver:true}).start();
    });
    unlockTimer.current=setTimeout(unlock,450);
  }
  function closeReader(navigate:()=>void){unlock();navigate();}
  return <TransitionContext.Provider value={{openReader,closeReader,transitioning}}>{children}<Animated.View pointerEvents="none" style={[styles.focus,{opacity:focusOpacity}]}/></TransitionContext.Provider>;
}

export function useDocumentTransition(){const value=useContext(TransitionContext);if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");return value;}

const styles=StyleSheet.create({focus:{...StyleSheet.absoluteFill,backgroundColor:"#000",zIndex:1000,elevation:1000}});
