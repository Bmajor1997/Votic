import { useEffect,useRef } from "react";
import { Animated,Image,StyleSheet,Text,View } from "react-native";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../theme/ThemeProvider";

export function VoticLogo({compact=false,markOnly=false,progress}:{compact?:boolean;markOnly?:boolean;progress?:number}){
  const {theme}=useVoticTheme();
  const {reduceMotion}=useAccessibilityPreferences();
  const size=compact?24:34;
  const wing1=useRef(new Animated.Value(1)).current;
  const wing2=useRef(new Animated.Value(1)).current;
  const wing3=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    if(progress!==undefined||reduceMotion){
      [wing1,wing2,wing3].forEach(value=>value.setValue(1));
      return;
    }
    const pulse=(value:Animated.Value)=>Animated.sequence([
      Animated.timing(value,{toValue:1.12,duration:110,useNativeDriver:true}),
      Animated.timing(value,{toValue:1,duration:140,useNativeDriver:true})
    ]);
    const animation=Animated.sequence([
      Animated.delay(180),
      pulse(wing1),
      Animated.delay(45),
      pulse(wing2),
      Animated.delay(45),
      pulse(wing3)
    ]);
    animation.start();
    return()=>animation.stop();
  },[progress,reduceMotion,wing1,wing2,wing3]);

  const wing=(value:Animated.Value,top:number,height:number,wingIndex:number)=>{
    const fill=progress===undefined?1:Math.max(0,Math.min(1,progress*3-wingIndex));
    const inset=progress===undefined?0:size*.42;
    return <View pointerEvents="none" style={[s.wingClip,{left:inset,width:(size-inset)*fill,height:size*height,top:size*top}]}>
      <Animated.Image
        source={require("../../assets/votic-wings-mask.png")}
        resizeMode="contain"
        tintColor={theme.logoWing}
        style={{position:"absolute",left:-inset,top:-size*top,width:size,height:size,transform:[{scale:value}]}}
      />
    </View>;
  };

  return <View accessible accessibilityRole="image" accessibilityLabel="Votic logo" style={s.row}>
    <View style={{width:size,height:size,marginTop:1}}>
      <Image source={require("../../assets/votic-mark.png")} resizeMode="contain" tintColor={theme.isDark?"#FFF":undefined} style={{width:size,height:size}}/>
      {progress===undefined?null:<Image source={require("../../assets/votic-wings-mask.png")} resizeMode="contain" tintColor={theme.surface} style={{position:"absolute",width:size,height:size}}/>}
      {wing(wing1,0,.34,0)}
      {wing(wing2,.31,.34,1)}
      {wing(wing3,.62,.38,2)}
    </View>
    {markOnly?null:<Text style={[compact?s.compact:s.logo,{color:theme.text}]}>otic</Text>}
  </View>;
}

const s=StyleSheet.create({
  row:{flexDirection:"row",alignItems:"center"},
  wingClip:{position:"absolute",overflow:"hidden"},
  logo:{fontSize:30,lineHeight:34,fontWeight:"900",letterSpacing:-1.2,marginLeft:-3},
  compact:{fontSize:22,lineHeight:24,fontWeight:"900",letterSpacing:-.9,marginLeft:-3}
});
