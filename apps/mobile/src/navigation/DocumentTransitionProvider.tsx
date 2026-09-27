import { PropsWithChildren,createContext,useContext,useRef,useState } from "react";
import { Animated,Easing } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

export type DocumentTransitionSnapshot={title:string;subtitle:string;progress:number;rect:{x:number;y:number;width:number;height:number}};
type TransitionContextValue={
  openReader:(snapshot:DocumentTransitionSnapshot,navigate:()=>void)=>void;
  closeReader:(navigate:()=>void)=>void;
  readerReady:()=>void;
  backdropStyle:any;
  readerStyle:any;
  transitioning:boolean;
};

const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {reduceMotion}=useAccessibilityPreferences();
  const [snapshot,setSnapshot]=useState<DocumentTransitionSnapshot|null>(null);
  const [closing,setClosing]=useState(false);
  const origin=useRef<DocumentTransitionSnapshot|null>(null);
  const progress=useRef(new Animated.Value(0)).current;

  function animate(toValue:number,duration:number,onComplete:()=>void){
    Animated.timing(progress,{toValue,duration,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start(({finished})=>{if(finished)onComplete();});
  }
  function openReader(next:DocumentTransitionSnapshot,navigate:()=>void){
    origin.current=next;setClosing(false);setSnapshot(next);progress.setValue(0);
    requestAnimationFrame(navigate);
  }
  function readerReady(){
    if(!snapshot)return;
    requestAnimationFrame(()=>animate(1,reduceMotion?120:340,()=>setSnapshot(null)));
  }
  function closeReader(navigate:()=>void){
    const previous=origin.current;
    if(!previous||reduceMotion){navigate();return;}
    setClosing(true);setSnapshot(previous);progress.setValue(1);
    requestAnimationFrame(()=>animate(0,180,()=>{navigate();setSnapshot(null);setClosing(false);}));
  }

  const backdropStyle=snapshot?{opacity:progress}:{opacity:1};
  const readerStyle=snapshot?{opacity:progress,transform:[{translateY:reduceMotion||closing?0:progress.interpolate({inputRange:[0,1],outputRange:[8,0]})},{scale:reduceMotion||closing?1:progress.interpolate({inputRange:[0,1],outputRange:[.975,1]})}]}:{opacity:1,transform:[{translateY:0},{scale:1}]};
  return <TransitionContext.Provider value={{openReader,closeReader,readerReady,backdropStyle,readerStyle,transitioning:Boolean(snapshot)}}>
    {children}
  </TransitionContext.Provider>;
}

export function useDocumentTransition(){
  const value=useContext(TransitionContext);
  if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}
