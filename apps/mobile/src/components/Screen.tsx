import { PropsWithChildren,ReactNode,createContext,useContext,useRef,useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Animated,Pressable,StyleSheet,Text,View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVoticTheme } from "../theme/ThemeProvider";
import { VoticLogo } from "./VoticLogo";
import { useDocumentLibrary } from "../documents/DocumentLibraryProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useDocumentTransition } from "../navigation/DocumentTransitionProvider";

const ScrollFadeContext=createContext<{scrollY:Animated.Value;enabled:boolean}|null>(null);
export function ScrollFadeItem({children,style}:{children:ReactNode;style?:object}){
  const context=useContext(ScrollFadeContext);const [top,setTop]=useState(0);const itemRef=useRef<View>(null);
  if(!context)return <View style={style}>{children}</View>;
  const opacity=context.enabled?context.scrollY.interpolate({inputRange:[Math.max(0,top-92),Math.max(1,top-18)],outputRange:[1,.08],extrapolate:"clamp"}):1;
  function layout(){requestAnimationFrame(()=>itemRef.current?.measureInWindow((_x,y)=>setTop(y)));}
  return <Animated.View ref={itemRef} onLayout={layout} style={[style,{opacity}]}>{children}</Animated.View>;
}

export function Screen({title,children,hideTitle=false,titleAction}:PropsWithChildren<{title:string;hideTitle?:boolean;titleAction?:ReactNode}>){
  const {theme}=useVoticTheme();
  const {persistenceError}=useDocumentLibrary();
  const {reduceMotion}=useAccessibilityPreferences();
  const transition=useDocumentTransition();
  const scrollY=useRef(new Animated.Value(0)).current;
  const screenOpacity=transition.progress.interpolate({inputRange:[0,.7,1],outputRange:[1,.88,.04],extrapolate:"clamp"});
  return <SafeAreaView edges={["top","left","right"]} style={[s.safe,{backgroundColor:theme.background}]}>
    <Animated.View style={[s.safe,{opacity:transition.transitioning?screenOpacity:1}]}><Animated.ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}>
      <ScrollFadeContext.Provider value={{scrollY,enabled:!reduceMotion}}>
      <View style={s.brandBar} accessibilityRole="header"><VoticLogo/><Pressable accessibilityRole="button" accessibilityLabel="Search" style={s.headerIcon}><Ionicons name="search" size={22} color={theme.text}/></Pressable></View>
      {persistenceError?<View accessibilityRole="alert" style={[s.warning,{borderColor:theme.border,backgroundColor:theme.surfaceMuted}]}><Ionicons name="warning-outline" size={20} color={theme.accent}/><Text style={[s.warningText,{color:theme.text}]}>{persistenceError}</Text></View>:null}
      {!hideTitle?<View style={s.titleRow}><Text accessibilityRole="header" style={[s.title,{color:theme.text}]}>{title}</Text>{titleAction}</View>:null}
      {children}
      </ScrollFadeContext.Provider>
    </Animated.ScrollView></Animated.View>
  </SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},content:{paddingHorizontal:20,paddingBottom:32,gap:16},brandBar:{minHeight:58,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},headerIcon:{width:44,height:44,alignItems:"center",justifyContent:"center"},titleRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},title:{fontSize:26,fontWeight:"800",letterSpacing:-.5,flexShrink:1},warning:{borderWidth:1,borderRadius:12,padding:12,flexDirection:"row",alignItems:"flex-start",gap:10},warningText:{flex:1,fontSize:13,lineHeight:19,fontWeight:"600"}});
