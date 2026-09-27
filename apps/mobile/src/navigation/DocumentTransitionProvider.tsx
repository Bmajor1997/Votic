import { PropsWithChildren,createContext,useContext,useRef,useState } from "react";
import { Animated,Easing,StyleSheet,Text,View,useWindowDimensions } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { radii,spacing,typography } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

export type DocumentTransitionSnapshot={title:string;subtitle:string;progress:number;rect:{x:number;y:number;width:number;height:number}};
type TransitionContextValue={
  openReader:(snapshot:DocumentTransitionSnapshot,navigate:()=>void)=>void;
  closeReader:(navigate:()=>void)=>void;
  readerStyle:{opacity:number|Animated.AnimatedInterpolation<number>;transform:{translateY:number|Animated.AnimatedInterpolation<number>}[]};
  transitioning:boolean;
};

const TransitionContext=createContext<TransitionContextValue|null>(null);

export function DocumentTransitionProvider({children}:PropsWithChildren){
  const {theme}=useVoticTheme();
  const {reduceMotion}=useAccessibilityPreferences();
  const [snapshot,setSnapshot]=useState<DocumentTransitionSnapshot|null>(null);
  const origin=useRef<DocumentTransitionSnapshot|null>(null);
  const progress=useRef(new Animated.Value(0)).current;
  const screen=useWindowDimensions();

  function animate(toValue:number,duration:number,onComplete:()=>void){
    Animated.timing(progress,{toValue,duration,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start(({finished})=>{if(finished)onComplete();});
  }
  function openReader(next:DocumentTransitionSnapshot,navigate:()=>void){
    origin.current=next;setSnapshot(next);progress.setValue(0);
    requestAnimationFrame(()=>{
      animate(reduceMotion?1:.08,reduceMotion?140:55,()=>{
        navigate();
        if(reduceMotion){setSnapshot(null);return;}
        requestAnimationFrame(()=>animate(1,345,()=>setSnapshot(null)));
      });
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

  const left=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.x,0]}):0;
  const top=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.y,0]}):0;
  const width=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.width,screen.width]}):0;
  const height=snapshot?progress.interpolate({inputRange:[0,1],outputRange:[snapshot.rect.height,screen.height]}):0;
  const radius=progress.interpolate({inputRange:[0,1],outputRange:[radii.lg,0]});
  const cardOpacity=reduceMotion?progress:progress.interpolate({inputRange:[0,.82,1],outputRange:[1,1,0]});
  const readerStyle=snapshot?{opacity:reduceMotion?progress:progress.interpolate({inputRange:[0,.68,1],outputRange:[0,0,1]}),transform:[{translateY:reduceMotion?0:progress.interpolate({inputRange:[0,.7,1],outputRange:[12,12,0]})}]}:{opacity:1,transform:[{translateY:0}]};
  return <TransitionContext.Provider value={{openReader,closeReader,readerStyle,transitioning:Boolean(snapshot)}}>
    {children}
    {snapshot?<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.overlay}>
      <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:theme.background,opacity:progress}]}/>
      <Animated.View style={[s.card,{left,top,width,height,borderRadius:radius,opacity:cardOpacity,backgroundColor:theme.surface,borderColor:theme.border}]}>
        <Animated.View style={[s.copy,{transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[0,44]})}],opacity:progress.interpolate({inputRange:[0,.84,1],outputRange:[1,1,0]})}]}>
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

const s=StyleSheet.create({overlay:{position:"absolute",left:0,right:0,top:0,bottom:0,zIndex:999,elevation:999,backgroundColor:"transparent"},card:{position:"absolute",borderWidth:1,overflow:"hidden",shadowColor:"#000",shadowOpacity:.14,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:8},copy:{padding:spacing.lg,gap:spacing.sm},title:{...typography.sectionTitle},subtitle:{fontSize:14},track:{height:3,borderRadius:2,overflow:"hidden"},fill:{height:"100%"}});
