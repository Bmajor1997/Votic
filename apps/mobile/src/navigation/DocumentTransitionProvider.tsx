import { PropsWithChildren,createContext,useContext,useRef,useState } from "react";
import { Animated,Easing } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

export type DocumentTransitionSnapshot={title:string;subtitle:string;progress:number;rect:{x:number;y:number;width:number;height:number}};
type TransitionContextValue={
  openReader:(snapshot:DocumentTransitionSnapshot,navigate:()=>void)=>void;
  closeReader:(navigate:()=>void)=>void;
  readerStyle:{opacity:number|Animated.AnimatedInterpolation<number>;transform:{translateY:number|Animated.AnimatedInterpolation<number>}[]};
  transitioning:boolean;
};

const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {reduceMotion}=useAccessibilityPreferences();
  const [snapshot,setSnapshot]=useState<DocumentTransitionSnapshot|null>(null);
  const origin=useRef<DocumentTransitionSnapshot|null>(null);
  const progress=useRef(new Animated.Value(0)).current;

  function animate(toValue:number,duration:number,onComplete:()=>void){
    Animated.timing(progress,{toValue,duration,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start(({finished})=>{if(finished)onComplete();});
  }
  function openReader(next:DocumentTransitionSnapshot,navigate:()=>void){
    origin.current=next;setSnapshot(next);progress.setValue(0);
    requestAnimationFrame(()=>{
      navigate();
      requestAnimationFrame(()=>animate(1,reduceMotion?120:260,()=>setSnapshot(null)));
    });
  }
  function closeReader(navigate:()=>void){
    const previous=origin.current;
    if(!previous||reduceMotion){navigate();return;}
    setSnapshot(previous);progress.setValue(1);
    requestAnimationFrame(()=>{
      navigate();
      requestAnimationFrame(()=>animate(0,reduceMotion?140:360,()=>setSnapshot(null)));
    });
  }

  const readerStyle=snapshot?{opacity:progress,transform:[{translateY:reduceMotion?0:progress.interpolate({inputRange:[0,1],outputRange:[8,0]})}]}:{opacity:1,transform:[{translateY:0}]};
  return <TransitionContext.Provider value={{openReader,closeReader,readerStyle,transitioning:Boolean(snapshot)}}>
    {children}
  </TransitionContext.Provider>;
}

export function useDocumentTransition(){
  const value=useContext(TransitionContext);
  if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}
