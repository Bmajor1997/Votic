import { PropsWithChildren,createContext,useContext,useRef,useState } from "react";
import { Animated,Dimensions,Easing,StyleSheet,Text,View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii,spacing,typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

export type DocumentTransitionSnapshot={title:string;subtitle:string;progress:number;rect:{x:number;y:number;width:number;height:number}};
type TransitionContextValue={
  openReader:(snapshot:DocumentTransitionSnapshot,navigate:()=>void)=>void;
  closeReader:(navigate:()=>void)=>void;
};

const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {theme}=useVoticTheme();
  const {reduceMotion}=useAccessibilityPreferences();
  const [snapshot,setSnapshot]=useState<DocumentTransitionSnapshot|null>(null);
  const origin=useRef<DocumentTransitionSnapshot|null>(null);
  const progress=useRef(new Animated.Value(0)).current;
  const screen=Dimensions.get("window");

  function animate(toValue:number,duration:number,onComplete:()=>void){
    Animated.timing(progress,{toValue,duration,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start(({finished})=>{if(finished)onComplete();});
  }
  function openReader(next:DocumentTransitionSnapshot,navigate:()=>void){
    origin.current=next;setSnapshot(next);progress.setValue(0);navigate();
    if(reduceMotion){animate(1,150,()=>setSnapshot(null));return;}
    requestAnimationFrame(()=>animate(1,280,()=>setSnapshot(null)));
  }
  function closeReader(navigate:()=>void){
    const previous=origin.current;
    if(!previous||reduceMotion){navigate();return;}
    setSnapshot(previous);
    progress.setValue(1);navigate();
    requestAnimationFrame(()=>animate(0,240,()=>setSnapshot(null)));
  }

  const left=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.x,spacing.md]}):0;
  const top=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.y,spacing.md]}):0;
  const width=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.width,screen.width-spacing.md*2]}):0;
  const height=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.height,screen.height-spacing.md*2]}):0;
  const opacity=reduceMotion?progress:1;
  return <TransitionContext.Provider value={{openReader,closeReader}}>
    {children}
    {snapshot?<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.card,{left,top,width,height,opacity,backgroundColor:theme.surface,borderColor:theme.border}]}>
        <Animated.View style={[s.copy,{opacity:progress.interpolate({inputRange:[0,.72,1],outputRange:[1,1,0]})}]}>
          <Text numberOfLines={2} style={[s.title,{color:theme.text}]}>{snapshot.title}</Text>
          <Text numberOfLines={1} style={[s.subtitle,{color:theme.mutedText}]}>{snapshot.subtitle}</Text>
          <View style={[s.track,{backgroundColor:theme.border}]}><View style={[s.fill,{backgroundColor:theme.accent,width:`${snapshot.progress*100}%` as `${number}%`}]}/></View>
        </Animated.View>
      </Animated.View>
    </View>:null}
  </TransitionContext.Provider>;
}

export function useDocumentTransition(){
  const value=useContext(TransitionContext);
  if(!value)throw new Error("useDocumentTransition must be used inside DocumentTransitionProvider");
  return value;
}

const s=StyleSheet.create({card:{position:"absolute",borderWidth:1,borderRadius:radii.lg,overflow:"hidden",shadowColor:"#000",shadowOpacity:.12,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:8},copy:{padding:spacing.lg,gap:spacing.sm},title:{...typography.sectionTitle},subtitle:{fontSize:14},track:{height:3,borderRadius:2,overflow:"hidden"},fill:{height:"100%"}});
