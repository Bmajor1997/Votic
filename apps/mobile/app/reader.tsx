import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { ReactNode,useEffect,useMemo,useRef,useState } from "react";
import { Animated,BackHandler,GestureResponderEvent,Image,KeyboardAvoidingView,LayoutChangeEvent,Modal,NativeScrollEvent,NativeSyntheticEvent,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,TextStyle,View,useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HighlightMode,ReaderFont,ReadingSpacing,TextSize,useAccessibilityPreferences } from "../src/accessibility/AccessibilityProvider";
import { PlaybackSpeedControl } from "../src/components/PlaybackSpeedControl";
import { VoticLogo } from "../src/components/VoticLogo";
import { controlSizes,radii,spacing,typography } from "../src/design/tokens";
import { useDocumentLibrary } from "../src/documents/DocumentLibraryProvider";
import { documentTimeSpent } from "../src/documents/insights";
import { formatPlaybackRate,normalizePlaybackRate } from "../src/playback/rates";
import { AppearanceMode,useVoticTheme } from "../src/theme/ThemeProvider";
import { useDocumentTransition } from "../src/navigation/DocumentTransitionProvider";

type ReaderSheet="appearance"|"focus"|"listen"|null;
type Voice=Awaited<ReturnType<typeof Speech.getAvailableVoicesAsync>>[number];

const VOTIC_VOICE_NAMES=["Arden","Kaia","Soren","Mira","Evren","Nyla","Kellan","Elara"] as const;
const VOTIC_VOICE_PREVIEWS=[
  "Hi, I'm Arden. I'm here to make reading feel clear, comfortable, and easy to follow.",
  "Hi, I'm Kaia. Choose me when you want a bright, expressive voice to read alongside you.",
  "Hi, I'm Soren. I'll help you settle in, focus on the words, and move through your reading at your pace.",
  "Hi, I'm Mira. I'm here to make listening feel calm, natural, and comfortable.",
  "Hi, I'm Evren. I'll keep your reading clear and steady, whether you're studying or simply listening.",
  "Hi, I'm Nyla. I'm here to make your documents feel a little more conversational and easy to enjoy.",
  "Hi, I'm Kellan. Choose me for a relaxed, grounded reading experience that stays out of your way.",
  "Hi, I'm Elara. I'll bring a gentle, polished voice to whatever you choose to read."
] as const;
function voticVoiceName(index:number){return VOTIC_VOICE_NAMES[index]??`Voice ${index+1}`;}
function voticVoicePreview(index:number){return VOTIC_VOICE_PREVIEWS[index]??`Hi, I'm Voice ${index+1}. Here's a quick preview of how I'll sound while reading with you.`;}
function uniqueEnglishVoices(available:Voice[]){
  const seen=new Set<string>();
  return available.filter(voice=>voice.language.toLowerCase().startsWith("en")).filter(voice=>{const key=(voice.name.trim()||voice.identifier).toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,VOTIC_VOICE_NAMES.length);
}

function sentences(text:string){return text.match(/[^.!?]+[.!?]+[\]"')]*|[^.!?]+$/g)?.map(value=>value.trim()).filter(Boolean)||[];}
function wordMatches(text:string){return [...text.matchAll(/\S+/g)];}
function locationForProgress(passages:string[],progress:number){
  const counts=passages.map(passage=>wordMatches(passage).length);const total=counts.reduce((sum,count)=>sum+count,0);
  if(!total)return {sentenceIndex:0,wordIndex:0};
  let target=Math.min(total-1,Math.max(0,Math.floor(Math.max(0,Math.min(1,progress))*total)));
  for(let sentenceIndex=0;sentenceIndex<counts.length;sentenceIndex+=1){if(target<counts[sentenceIndex])return {sentenceIndex,wordIndex:target};target-=counts[sentenceIndex];}
  return {sentenceIndex:Math.max(0,passages.length-1),wordIndex:Math.max(0,counts[counts.length-1]-1)};
}
function progressForLocation(passages:string[],sentenceIndex:number,wordIndex:number){
  const counts=passages.map(passage=>wordMatches(passage).length);const total=counts.reduce((sum,count)=>sum+count,0);if(total<=1)return total?1:0;
  const before=counts.slice(0,Math.max(0,sentenceIndex)).reduce((sum,count)=>sum+count,0);const current=Math.min(Math.max(0,wordIndex),Math.max(0,(counts[sentenceIndex]||1)-1));
  return Math.max(0,Math.min(1,(before+current)/(total-1)));
}
function speechSegment(text:string,startWord:number){const words=wordMatches(text);const safe=Math.max(0,Math.min(startWord,Math.max(0,words.length-1)));const start=words[safe]?.index??0;return {text:text.slice(start),startChar:start,startWord:safe,words};}
function timeSpentLabel(seconds:number){if(seconds<30)return "<1 min";const minutes=Math.round(seconds/60);if(minutes<60)return `${minutes} min`;const hours=Math.floor(minutes/60);const remainder=minutes%60;return remainder?`${hours} hr ${remainder} min`:`${hours} hr`;}
function clockLabel(seconds:number){const safe=Math.max(0,Math.round(seconds));const minutes=Math.floor(safe/60);return `${minutes}:${String(safe%60).padStart(2,"0")}`;}
function readerType(textSize:TextSize,readingSpacing:ReadingSpacing,readerFont:ReaderFont,textSpacing:"default"|"wide"):TextStyle{
  const fontSize=textSize==="extra-large"?25:textSize==="large"?21:18;
  const lineScale=readingSpacing==="extra"?1.9:readingSpacing==="compact"?1.42:1.65;
  return {fontSize,lineHeight:Math.round(fontSize*lineScale),letterSpacing:textSpacing==="wide"?.75:0,fontFamily:readerFont==="serif"?"serif":readerFont==="accessible"?"sans-serif":undefined};
}

function Choice<T extends string>({label,value,current,onChange}:{label:string;value:T;current:T;onChange:(value:T)=>void}){
  const {theme}=useVoticTheme();const selected=value===current;
  return <Pressable accessibilityRole="radio" accessibilityState={{checked:selected}} onPress={()=>onChange(value)} style={({pressed})=>[s.choice,{borderColor:selected?theme.accent:theme.border,backgroundColor:selected?theme.sentenceHighlight:theme.surface,opacity:pressed?.7:1}]}><Text style={[s.choiceText,{color:selected?theme.accent:theme.text}]}>{label}</Text></Pressable>;
}

function Setting({label,children}:{label:string;children:ReactNode}){const {theme}=useVoticTheme();return <View style={s.setting}><Text style={[s.settingLabel,{color:theme.mutedText}]}>{label}</Text><View style={s.choiceRow}>{children}</View></View>;}

function SeekableProgress({value,compact=false,onSeekStart,onSeek}:{value:number;compact?:boolean;onSeekStart:()=>void;onSeek:(value:number)=>void}){
  const {theme}=useVoticTheme();const [draft,setDraft]=useState<number|null>(null);const width=useRef(1);const shown=draft??value;
  function valueFromEvent(event:GestureResponderEvent){return Math.max(0,Math.min(1,event.nativeEvent.locationX/width.current));}
  function begin(event:GestureResponderEvent){const next=valueFromEvent(event);onSeekStart();setDraft(next);}
  function move(event:GestureResponderEvent){setDraft(valueFromEvent(event));}
  function finish(event:GestureResponderEvent){const next=valueFromEvent(event);setDraft(null);onSeek(next);}
  function adjust(direction:"increment"|"decrement"){onSeekStart();onSeek(Math.max(0,Math.min(1,value+(direction==="increment"?.05:-.05))));}
  return <View
    accessible accessibilityRole="adjustable" accessibilityLabel="Document playback position" accessibilityValue={{min:0,max:100,now:Math.round(shown*100),text:`${Math.round(shown*100)} percent`}}
    accessibilityActions={[{name:"increment",label:"Move forward"},{name:"decrement",label:"Move backward"}]}
    onAccessibilityAction={event=>{const name=event.nativeEvent.actionName;if(name==="increment"||name==="decrement")adjust(name);}}
    onLayout={event=>{width.current=Math.max(1,event.nativeEvent.layout.width);}}
    onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={begin} onResponderMove={move} onResponderRelease={finish} onResponderTerminate={finish} onResponderTerminationRequest={()=>false}
    style={[s.seekTarget,compact&&s.seekTargetCompact]}
  ><View style={[compact?s.dockTrack:s.track,{backgroundColor:theme.border}]}><View style={[s.fill,{backgroundColor:theme.accent,width:`${shown*100}%` as `${number}%`}]}/><View style={[s.seekThumb,{backgroundColor:theme.accent,left:`${shown*100}%` as `${number}%`}]}/></View></View>;
}

export default function Reader(){
  const {theme,appearanceMode,setAppearanceMode}=useVoticTheme();
  const accessibility=useAccessibilityPreferences();
  const transition=useDocumentTransition();
  const window=useWindowDimensions();
  const {activeDocument,savePassage,removePassage,updateProgress,recordActivity,completeDocument,updatePlaybackRate}=useDocumentLibrary();
  const passages=useMemo(()=>sentences(activeDocument?.plainText||""),[activeDocument?.plainText]);
  const [index,setIndex]=useState(activeDocument?.sentenceIndex||0);
  const [wordIndex,setWordIndex]=useState(activeDocument?.wordIndex||0);
  const [rate,setRate]=useState(normalizePlaybackRate(activeDocument?.playbackRate||1));
  const [playing,setPlaying]=useState(false);
  const [sheet,setSheet]=useState<ReaderSheet>(null);
  const [completionOpen,setCompletionOpen]=useState(false);
  const [saveOpen,setSaveOpen]=useState(false);
  const [noteDraft,setNoteDraft]=useState("");
  const [voices,setVoices]=useState<Voice[]>([]);
  const [previewVoiceIdentifier,setPreviewVoiceIdentifier]=useState<string|null>(null);
  const scrollRef=useRef<ScrollView>(null);
  const speechSession=useRef(0);
  const seekWasPlaying=useRef(false);
  const sentenceLayout=useRef<Record<number,{y:number;height:number}>>({});
  const scrollOffset=useRef(0);
  const viewportHeight=useRef(0);
  const manuallyScrolling=useRef(false);
  const closing=useRef(false);
  const readerPrepared=useRef(false);
  const [readerReady,setReaderReady]=useState(false);
  const completedRef=useRef(activeDocument?.progress===1);
  const readingType=readerType(accessibility.textSize,accessibility.readingSpacing,accessibility.readerFont,accessibility.textSpacing);
  const progress=useMemo(()=>progressForLocation(passages,index,wordIndex),[passages,index,wordIndex]);

  useEffect(()=>{void Speech.getAvailableVoicesAsync().then(available=>setVoices(uniqueEnglishVoices(available))).catch(()=>setVoices([]));},[]);
  useEffect(()=>()=>{speechSession.current+=1;void Speech.stop();},[]);
  useEffect(()=>{const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{void closeReader();return true;});return()=>subscription.remove();},[transition,accessibility.reduceMotion]);
  useEffect(()=>{if(!activeDocument||!passages.length||completedRef.current)return;updateProgress(activeDocument.id,progress,index,wordIndex);},[activeDocument?.id,passages.length,progress,index,wordIndex]);
  useEffect(()=>{followActiveWord();},[index,wordIndex,accessibility.reduceMotion]);
  useEffect(()=>{if(!activeDocument)return;let lastSavedAt=Date.now();function saveElapsed(){if(!activeDocument)return;const seconds=Math.floor((Date.now()-lastSavedAt)/1000);if(seconds<1)return;lastSavedAt+=seconds*1000;recordActivity(activeDocument.id,seconds,playing?seconds:0);}const interval=setInterval(saveElapsed,10000);return()=>{clearInterval(interval);saveElapsed();};},[activeDocument?.id,playing]);

  async function closeReader(){
    if(closing.current)return;
    closing.current=true;
    await stop();
    transition.closeReader(()=>router.back());
  }
  function prepareReader(){
    if(readerPrepared.current||!viewportHeight.current)return;
    if(passages.length&&sentenceLayout.current[index]===undefined)return;
    readerPrepared.current=true;
    followActiveWord(true,false);
    requestAnimationFrame(()=>{setReaderReady(true);transition.beginReader();});
  }
  function followActiveWord(force=false,animated=!accessibility.reduceMotion){
    if(manuallyScrolling.current&&!force)return;const layout=sentenceLayout.current[index];if(!layout||!viewportHeight.current)return;
    const words=Math.max(1,wordMatches(passages[index]||"").length);const wordFraction=Math.max(0,Math.min(1,wordIndex/words));const estimatedY=layout.y+layout.height*wordFraction;
    const top=scrollOffset.current+24;const bottom=scrollOffset.current+viewportHeight.current*.7;
    if(force||estimatedY<top||estimatedY>bottom)scrollRef.current?.scrollTo({y:Math.max(0,estimatedY-viewportHeight.current*.45),animated});
  }
  function measureSentence(sentenceIndex:number,event:LayoutChangeEvent){const {y,height}=event.nativeEvent.layout;sentenceLayout.current[sentenceIndex]={y,height};if(sentenceIndex===index)prepareReader();}
  function trackScroll(event:NativeSyntheticEvent<NativeScrollEvent>){scrollOffset.current=event.nativeEvent.contentOffset.y;}
  async function stop(){speechSession.current+=1;setPlaying(false);setPreviewVoiceIdentifier(null);await Speech.stop();}
  async function previewVoice(voice:Voice,voiceIndex:number){
    speechSession.current+=1;setPlaying(false);await Speech.stop();setPreviewVoiceIdentifier(voice.identifier);
    Speech.speak(voticVoicePreview(voiceIndex),{voice:voice.identifier,rate:1,onDone:()=>setPreviewVoiceIdentifier(current=>current===voice.identifier?null:current),onStopped:()=>setPreviewVoiceIdentifier(current=>current===voice.identifier?null:current),onError:()=>setPreviewVoiceIdentifier(current=>current===voice.identifier?null:current)});
  }
  function speak(at=index,startWord=at===index?wordIndex:0){const session=speechSession.current+1;speechSession.current=session;void beginSpeech(at,startWord,session,true);}
  async function beginSpeech(at:number,startWord:number,session:number,clearQueue:boolean){
    if(!activeDocument||!passages[at]||session!==speechSession.current)return;
    if(clearQueue)await Speech.stop();if(session!==speechSession.current)return;
    const passage=passages[at];const segment=speechSegment(passage,startWord);setIndex(at);setWordIndex(segment.startWord);setPlaying(true);
    Speech.speak(segment.text,{rate,voice:accessibility.voiceIdentifier||undefined,onBoundary:(event:any)=>{if(session!==speechSession.current||event?.name&&event.name!=="word")return;const relativeOffset=Number(event?.charIndex);if(!Number.isFinite(relativeOffset))return;const sourceOffset=segment.startChar+relativeOffset;let next=segment.words.findIndex((match,i)=>sourceOffset>=(match.index??0)&&sourceOffset<(segment.words[i+1]?.index??Infinity));if(next<0)next=segment.startWord;if(next>=0)setWordIndex(next);},onDone:()=>{if(session!==speechSession.current)return;if(at<passages.length-1)void beginSpeech(at+1,0,session,false);else finishDocument(false);},onStopped:()=>{if(session===speechSession.current)setPlaying(false);},onError:()=>{if(session===speechSession.current)setPlaying(false);}});
  }
  function toggle(){playing?void stop():speak();}
  function jump(delta:number){void stop();setWordIndex(0);setIndex(current=>Math.max(0,Math.min(passages.length-1,current+delta)));}
  function beginSeek(){seekWasPlaying.current=playing;speechSession.current+=1;setPlaying(false);void Speech.stop();}
  async function seekTo(value:number){
    if(!activeDocument||!passages.length)return;const resume=seekWasPlaying.current;seekWasPlaying.current=false;const location=locationForProgress(passages,value);
    speechSession.current+=1;await Speech.stop();setIndex(location.sentenceIndex);setWordIndex(location.wordIndex);completedRef.current=false;updateProgress(activeDocument.id,value,location.sentenceIndex,location.wordIndex);
    if(resume){const session=speechSession.current+1;speechSession.current=session;void beginSpeech(location.sentenceIndex,location.wordIndex,session,false);}
  }
  function changeRate(value:number){setRate(value);if(activeDocument)updatePlaybackRate(activeDocument.id,value);}
  function openSheet(next:Exclude<ReaderSheet,null>){setSheet(next);}
  function finishDocument(stopSpeech=true){if(!activeDocument||!passages.length)return;if(stopSpeech)void stop();const finalIndex=passages.length-1;const finalWord=Math.max(0,wordMatches(passages[finalIndex]).length-1);completedRef.current=true;setPlaying(false);setIndex(finalIndex);setWordIndex(finalWord);completeDocument(activeDocument.id,finalIndex,finalWord);setCompletionOpen(true);}
  const totalWords=useMemo(()=>wordMatches(activeDocument?.plainText||"").length,[activeDocument?.plainText]);
  const totalSeconds=totalWords/Math.max(.1,2.6*rate);
  const elapsedSeconds=totalSeconds*progress;
  const sentenceHighlight=accessibility.highlightMode==="sentence"||accessibility.highlightMode==="both";
  const wordHighlight=accessibility.highlightMode==="word"||accessibility.highlightMode==="both";
  const passageId="passage-"+index;
  const savedPassage=activeDocument?.savedPassages?.find(saved=>saved.id===passageId);
  function openSavePassage(){void stop();setNoteDraft(savedPassage?.note||"");setSaveOpen(true);}
  function confirmSavePassage(){if(!activeDocument||!passages[index])return;const now=Date.now();savePassage(activeDocument.id,{id:passageId,sentenceIndex:index,text:passages[index],note:noteDraft.trim(),createdAt:savedPassage?.createdAt||now,updatedAt:now});setSaveOpen(false);}
  function confirmRemovePassage(){if(!activeDocument||!savedPassage)return;removePassage(activeDocument.id,savedPassage.id);setSaveOpen(false);}

  const source=transition.sourceRect;
  const sourceScaleX=source?Math.max(.05,source.width/window.width):1;
  const sourceScaleY=source?Math.max(.05,source.height/window.height):1;
  const sourceTranslateX=source?source.x+source.width/2-window.width/2:0;
  const sourceTranslateY=source?source.y+source.height/2-window.height/2:0;
  const readerOpacity=readerReady?transition.progress.interpolate({inputRange:[0,.62,1],outputRange:[0,0,1],extrapolate:"clamp"}):0;

  return <View style={s.safe}><Animated.View style={[s.safe,{backgroundColor:theme.background,transform:[{translateX:transition.progress.interpolate({inputRange:[0,1],outputRange:[sourceTranslateX,0]})},{translateY:transition.progress.interpolate({inputRange:[0,1],outputRange:[sourceTranslateY,0]})},{scaleX:transition.progress.interpolate({inputRange:[0,1],outputRange:[sourceScaleX,1]})},{scaleY:transition.progress.interpolate({inputRange:[0,1],outputRange:[sourceScaleY,1]})}]}]}><Animated.View style={[s.safe,{opacity:readerOpacity}]}><SafeAreaView edges={["top","bottom","left","right"]} style={s.safe}>
    <View style={s.content}>
      <View style={s.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close reader" onPress={()=>{void closeReader();}} style={({pressed})=>[s.iconButton,{opacity:pressed?.55:1}]}><Ionicons name="chevron-down" size={27} color={theme.text}/></Pressable>
        <VoticLogo compact/>
        <View style={s.headerActions}><Pressable accessibilityRole="button" accessibilityLabel={savedPassage?"Edit saved passage":"Save current passage"} accessibilityState={{selected:Boolean(savedPassage)}} onPress={openSavePassage} style={({pressed})=>[s.iconButton,{opacity:pressed?.55:1}]}><Ionicons name={savedPassage?"bookmark":"bookmark-outline"} size={22} color={savedPassage?theme.accent:theme.text}/></Pressable></View>
      </View>
      <View style={s.documentHeader}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[s.title,s.compactTitle,{color:theme.text}]}>{activeDocument?.title||"Document reader"}</Text>
        <View style={s.progressCopy}><Text maxFontSizeMultiplier={1.2} style={[s.progressText,{color:theme.mutedText}]}>{Math.round(progress*100)}% read</Text><Text maxFontSizeMultiplier={1.2} style={[s.progressText,{color:theme.mutedText}]}>{Math.max(0,passages.length-index-1)} passages left</Text></View>
        <SeekableProgress value={progress} onSeekStart={beginSeek} onSeek={value=>void seekTo(value)}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask Votic about this document" onPress={()=>{void stop();router.push("/assistant");}} style={({pressed})=>[s.readingAsk,{borderColor:theme.border,backgroundColor:pressed?theme.surfaceMuted:theme.surface}]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.accent}/><Text numberOfLines={1} style={[s.readingAskText,{color:theme.accent}]}>Ask Votic</Text><Ionicons name="arrow-forward" size={16} color={theme.accent}/></Pressable>
      </View>
      <ScrollView ref={scrollRef} style={s.textArea} contentContainerStyle={s.readingContent} scrollEventThrottle={16} onLayout={event=>{viewportHeight.current=event.nativeEvent.layout.height;prepareReader();}} onScroll={trackScroll} onScrollBeginDrag={()=>{manuallyScrolling.current=true;}} onMomentumScrollBegin={()=>{manuallyScrolling.current=true;}} onScrollEndDrag={()=>{manuallyScrolling.current=false;}} onMomentumScrollEnd={()=>{manuallyScrolling.current=false;}}>
        {passages.map((passage,passageIndex)=>{const current=passageIndex===index;const tokens=current?passage.split(/(\s+)/):[];return <Text key={passageIndex} onLayout={event=>measureSentence(passageIndex,event)} style={[s.sentence,readingType,{color:theme.text},current&&sentenceHighlight&&{backgroundColor:theme.sentenceHighlight}]}>{current?tokens.map((token,tokenIndex)=>{if(/^\s+$/.test(token))return token;const before=tokens.slice(0,tokenIndex).join("");const spokenIndex=before.match(/\S+/g)?.length||0;const active=spokenIndex===wordIndex;return <Text key={tokenIndex} style={active&&wordHighlight?{color:theme.text,fontWeight:"900",fontSize:(readingType.fontSize as number)+2}:undefined}>{token}</Text>;}):passage}</Text>;})}
      </ScrollView>

      <View style={[s.dock,{borderColor:theme.border,backgroundColor:theme.surface}]}>
        <View style={[s.nowListeningHeader,s.compactListeningHeader]}><VoticLogo compact markOnly progress={progress}/><View style={s.nowListeningCopy}><Text maxFontSizeMultiplier={1.15} style={[s.nowListeningLabel,{color:theme.text}]}>Now Listening</Text><Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[s.nowListeningTitle,{color:theme.mutedText}]}>{activeDocument?.title||"Document"}</Text></View><Ionicons name="chevron-up" size={18} color={theme.mutedText}/></View>
        <View style={[s.controls,s.compactControls]}>
          <Pressable disabled={index===0} accessibilityRole="button" accessibilityLabel="Previous passage" onPress={()=>jump(-1)} style={({pressed})=>[s.control,{opacity:index===0?.3:pressed?.55:1}]}><Ionicons name="play-skip-back" size={25} color={index===0?theme.mutedText:theme.text}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={playing?"Pause":"Play"} onPress={toggle} style={({pressed})=>[s.play,{backgroundColor:theme.playButton},!accessibility.reduceMotion&&{transform:[{scale:pressed?.96:1}]}]}><Ionicons name={playing?"pause":"play"} size={30} color={theme.playIcon}/></Pressable>
          <Pressable disabled={!passages.length} accessibilityRole="button" accessibilityLabel={index>=passages.length-1?"Finish document":"Next passage"} onPress={()=>index>=passages.length-1?finishDocument():jump(1)} style={({pressed})=>[s.control,{opacity:!passages.length?.3:pressed?.55:1}]}><Ionicons name={index>=passages.length-1?"checkmark":"play-skip-forward"} size={index>=passages.length-1?29:25} color={theme.text}/></Pressable>
        </View>
        <View style={s.playbackMeta}><Text maxFontSizeMultiplier={1.15} style={[s.timeText,{color:theme.mutedText}]}>{clockLabel(elapsedSeconds)} / {clockLabel(totalSeconds)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${formatPlaybackRate(rate)}`} onPress={()=>openSheet("listen")} style={s.rateButton}><Text maxFontSizeMultiplier={1.15} style={[s.rateText,{color:theme.mutedText}]}>{formatPlaybackRate(rate)}</Text><Ionicons name="speedometer-outline" size={15} color={theme.mutedText}/></Pressable></View>
        <SeekableProgress compact value={progress} onSeekStart={beginSeek} onSeek={value=>void seekTo(value)}/>
        <View style={[s.toolRow,{borderTopColor:theme.border}]}>
          <ToolButton icon="text-outline" label="Text" active={sheet==="appearance"} onPress={()=>openSheet("appearance")}/>
          <ToolButton icon="color-palette-outline" label="Color" active={sheet==="appearance"} onPress={()=>openSheet("appearance")}/>
          <ToolButton icon="speedometer-outline" label="Speed" active={sheet==="listen"} onPress={()=>openSheet("listen")}/>
          <ToolButton icon={savedPassage?"bookmark":"bookmark-outline"} label="Bookmark" active={saveOpen} onPress={openSavePassage}/>
          <ToolButton icon="ellipsis-horizontal" label="More" active={sheet==="focus"} onPress={()=>openSheet("focus")}/>
        </View>
      </View>
    </View>

    <Modal visible={sheet!==null} transparent animationType={accessibility.reduceMotion?"none":"slide"} onRequestClose={()=>setSheet(null)}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close reader controls" onPress={()=>setSheet(null)} style={s.modalBackdrop}>
        <Pressable accessibilityRole="none" onPress={event=>event.stopPropagation()} style={[s.sheet,{backgroundColor:theme.surface}]}>
          <View style={[s.handle,{backgroundColor:theme.border}]}/>
          <View style={s.sheetHeader}><View><Text accessibilityRole="header" style={[s.sheetTitle,{color:theme.text}]}>{sheet==="appearance"?"Appearance":sheet==="focus"?"Reading focus":"Listen"}</Text><Text style={[s.sheetSubtitle,{color:theme.mutedText}]}>{sheet==="appearance"?"Changes appear in the document immediately.":sheet==="focus"?"Choose the guidance that helps you track the text.":"Choose a voice and comfortable listening speed."}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close reader controls" onPress={()=>setSheet(null)} style={s.iconButton}><Ionicons name="close" size={24} color={theme.text}/></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
            {sheet==="appearance"?<>
              <Setting label="Text size"><Choice label="A" value="default" current={accessibility.textSize} onChange={accessibility.setTextSize}/><Choice label="A+" value="large" current={accessibility.textSize} onChange={accessibility.setTextSize}/><Choice label="A++" value="extra-large" current={accessibility.textSize} onChange={accessibility.setTextSize}/></Setting>
              <Setting label="Font"><Choice label="Votic Sans" value="system" current={accessibility.readerFont} onChange={accessibility.setReaderFont}/><Choice label="Serif" value="serif" current={accessibility.readerFont} onChange={accessibility.setReaderFont}/><Choice label="Accessible" value="accessible" current={accessibility.readerFont} onChange={accessibility.setReaderFont}/></Setting>
              <Setting label="Theme"><Choice label="Light" value="light" current={appearanceMode} onChange={(value:AppearanceMode)=>setAppearanceMode(value)}/><Choice label="Dark" value="dark" current={appearanceMode} onChange={(value:AppearanceMode)=>setAppearanceMode(value)}/><Choice label="Device" value="system" current={appearanceMode} onChange={(value:AppearanceMode)=>setAppearanceMode(value)}/></Setting>
              <Setting label="Line spacing"><Choice label="Compact" value="compact" current={accessibility.readingSpacing} onChange={accessibility.setReadingSpacing}/><Choice label="Comfortable" value="default" current={accessibility.readingSpacing} onChange={accessibility.setReadingSpacing}/><Choice label="Open" value="extra" current={accessibility.readingSpacing} onChange={accessibility.setReadingSpacing}/></Setting>
              <Setting label="Text spacing"><Choice label="Standard" value="default" current={accessibility.textSpacing} onChange={accessibility.setTextSpacing}/><Choice label="Wide" value="wide" current={accessibility.textSpacing} onChange={accessibility.setTextSpacing}/></Setting>
            </>:null}
            {sheet==="focus"?<>
              <Setting label="Spoken-text highlight"><Choice label="Off" value="off" current={accessibility.highlightMode} onChange={accessibility.setHighlightMode}/><Choice label="Sentence" value="sentence" current={accessibility.highlightMode} onChange={accessibility.setHighlightMode}/><Choice label="Word" value="word" current={accessibility.highlightMode} onChange={accessibility.setHighlightMode}/><Choice label="Both" value="both" current={accessibility.highlightMode} onChange={accessibility.setHighlightMode}/></Setting>
              <View style={[s.toggleRow,{borderColor:theme.border}]}><View style={s.toggleCopy}><Text style={[s.toggleTitle,{color:theme.text}]}>Emphasize current word</Text><Text style={[s.toggleDescription,{color:theme.mutedText}]}>Adds weight and size as Votic reads.</Text></View><Switch accessibilityLabel="Emphasize current word" value={accessibility.wordEmphasis} onValueChange={accessibility.setWordEmphasis} trackColor={{true:theme.accent}}/></View>
            </>:null}
            {sheet==="listen"?<>
              <PlaybackSpeedControl rate={rate} onChange={changeRate}/>
              <Setting label="Voice">{voices.length?voices.map((voice,voiceIndex)=><VoiceChoice key={voice.identifier} name={voticVoiceName(voiceIndex)} selected={accessibility.voiceIdentifier===voice.identifier} previewing={previewVoiceIdentifier===voice.identifier} onPreview={()=>{if(previewVoiceIdentifier===voice.identifier)void stop();else void previewVoice(voice,voiceIndex);}} onSelect={()=>{void stop();accessibility.setVoiceIdentifier(voice.identifier);}}/>):<Text style={[s.emptyVoices,{color:theme.mutedText}]}>Your device voice will be used.</Text>}</Setting>
            </>:null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={completionOpen} transparent animationType={accessibility.reduceMotion?"none":"fade"} onRequestClose={()=>setCompletionOpen(false)}>
      <View style={s.completionBackdrop}>
        <View accessibilityViewIsModal style={[s.completionCard,{backgroundColor:theme.surface,borderColor:theme.border}]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close completion experience" onPress={()=>setCompletionOpen(false)} style={s.completionClose}><Ionicons name="close" size={23} color={theme.mutedText}/></Pressable>
          <Image accessibilityLabel="Highlighted reading notes" source={require("../assets/reader-highlight.png")} resizeMode="contain" style={s.completionImage}/>
          <Text accessibilityRole="header" style={[s.completionTitle,{color:theme.text}]}>Nicely done.</Text>
          <Text numberOfLines={2} style={[s.completionDocument,{color:theme.mutedText}]}>{activeDocument?.title}</Text>
          <Text style={[s.completionMessage,{color:theme.mutedText}]}>You made it through the whole document. Choose what would be useful next.</Text>
          <View style={s.completionStats}><View style={s.completionStat}><Text style={[s.completionValue,{color:theme.text}]}>{timeSpentLabel(documentTimeSpent(activeDocument))}</Text><Text style={[s.completionLabel,{color:theme.mutedText}]}>Time spent</Text></View><View style={[s.completionDivider,{backgroundColor:theme.border}]}/><View style={s.completionStat}><Text style={[s.completionValue,{color:theme.text}]}>{passages.length}</Text><Text style={[s.completionLabel,{color:theme.mutedText}]}>Passages</Text></View></View>
          <View style={s.completionGrid}><CompletionAction icon="chatbubble-ellipses-outline" label="Ask Votic" onPress={()=>{setCompletionOpen(false);router.push("/assistant");}}/><CompletionAction icon="bookmarks-outline" label="Notes" onPress={()=>{setCompletionOpen(false);router.push("/notes");}}/><CompletionAction icon="refresh-outline" label="Review" onPress={()=>{setCompletionOpen(false);router.push("/review");}}/><CompletionAction icon="add-circle-outline" label="Start another" onPress={()=>{setCompletionOpen(false);router.replace("/documents");}}/></View>
        </View>
      </View>
    </Modal>

    <Modal visible={saveOpen} transparent animationType={accessibility.reduceMotion?"none":"slide"} onRequestClose={()=>setSaveOpen(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==="ios"?"padding":undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close saved passage editor" onPress={()=>setSaveOpen(false)} style={StyleSheet.absoluteFill}/>
        <View accessibilityViewIsModal style={[s.sheet,{backgroundColor:theme.surface}]}>
          <View style={[s.handle,{backgroundColor:theme.border}]}/>
          <View style={s.sheetHeader}><View><Text accessibilityRole="header" style={[s.sheetTitle,{color:theme.text}]}>{savedPassage?"Saved passage":"Save passage"}</Text><Text style={[s.sheetSubtitle,{color:theme.mutedText}]}>Return to this moment from your document library.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close saved passage editor" onPress={()=>setSaveOpen(false)} style={s.iconButton}><Ionicons name="close" size={24} color={theme.text}/></Pressable></View>
          <Text numberOfLines={4} style={[s.savedExcerpt,{color:theme.text,backgroundColor:theme.surfaceMuted}]}>{passages[index]}</Text>
          <Text style={[s.settingLabel,{color:theme.mutedText}]}>NOTE — OPTIONAL</Text>
          <TextInput accessibilityLabel="Note about saved passage" value={noteDraft} onChangeText={setNoteDraft} placeholder="Why do you want to remember this?" placeholderTextColor={theme.mutedText} multiline maxLength={500} style={[s.noteInput,{color:theme.text,borderColor:theme.border,backgroundColor:theme.background}]}/>
          <View style={s.savedActions}>{savedPassage?<Pressable accessibilityRole="button" accessibilityLabel="Remove saved passage" onPress={confirmRemovePassage} style={({pressed})=>[s.removeButton,{borderColor:theme.border,opacity:pressed?.65:1}]}><Text style={[s.removeText,{color:theme.text}]}>Remove</Text></Pressable>:null}<Pressable accessibilityRole="button" accessibilityLabel={savedPassage?"Update saved passage":"Save passage"} onPress={confirmSavePassage} style={({pressed})=>[s.saveButton,{backgroundColor:theme.accent,opacity:pressed?.78:1}]}><Text style={s.saveText}>{savedPassage?"Update":"Save"}</Text></Pressable></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView></Animated.View></Animated.View></View>;
}

function VoiceChoice({name,selected,previewing,onPreview,onSelect}:{name:string;selected:boolean;previewing:boolean;onPreview:()=>void;onSelect:()=>void}){const {theme}=useVoticTheme();return <View style={[s.voiceChoice,{borderColor:selected?theme.accent:theme.border,backgroundColor:selected?theme.sentenceHighlight:theme.surface}]}><Pressable accessibilityRole="button" accessibilityLabel={previewing?`Stop ${name} voice preview`:`Preview ${name} voice`} onPress={onPreview} style={({pressed})=>[s.voicePreview,{backgroundColor:selected?theme.accent:theme.surfaceMuted,opacity:pressed?.7:1}]}><Ionicons name={previewing?"stop":"play"} size={18} color={selected?"#FFF":theme.accent}/></Pressable><Pressable accessibilityRole="radio" accessibilityState={{checked:selected}} accessibilityLabel={`Select ${name} voice`} onPress={onSelect} style={({pressed})=>[s.voiceSelect,{opacity:pressed?.7:1}]}><Text style={[s.voiceName,{color:selected?theme.accent:theme.text}]}>{name}</Text>{selected?<Ionicons name="checkmark-circle" size={19} color={theme.accent}/>:null}</Pressable></View>;}
function ToolButton({icon,label,active,onPress}:{icon:React.ComponentProps<typeof Ionicons>["name"];label:string;active:boolean;onPress:()=>void}){const {theme}=useVoticTheme();return <Pressable accessibilityRole="button" accessibilityState={{expanded:active}} onPress={onPress} style={({pressed})=>[s.tool,{backgroundColor:active?theme.sentenceHighlight:"transparent",opacity:pressed?.65:1}]}><Ionicons name={icon} size={19} color={active?theme.accent:theme.text}/><Text numberOfLines={1} maxFontSizeMultiplier={1.1} adjustsFontSizeToFit minimumFontScale={.72} style={[s.toolLabel,{color:active?theme.accent:theme.text}]}>{label}</Text></Pressable>;}
function CompletionAction({icon,label,onPress}:{icon:React.ComponentProps<typeof Ionicons>["name"];label:string;onPress:()=>void}){const {theme}=useVoticTheme();return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>[s.completionAction,{borderColor:theme.border,backgroundColor:pressed?theme.surfaceMuted:theme.surface}]}><Ionicons name={icon} size={22} color={theme.accent}/><Text style={[s.completionActionText,{color:theme.text}]}>{label}</Text></Pressable>;}

const s=StyleSheet.create({
  safe:{flex:1},content:{flex:1,paddingHorizontal:spacing.lg},topBar:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},headerActions:{flexDirection:"row"},iconButton:{width:controlSizes.minimumTouch,height:controlSizes.minimumTouch,justifyContent:"center",alignItems:"center"},documentHeader:{gap:spacing.xs,paddingTop:spacing.xs,paddingBottom:spacing.sm},title:{...typography.screenTitle,fontSize:25},compactTitle:{fontSize:19,lineHeight:24},progressCopy:{flexDirection:"row",justifyContent:"space-between"},progressText:{fontSize:12,fontWeight:"600"},seekTarget:{minHeight:36,justifyContent:"center"},seekTargetCompact:{minHeight:28,marginHorizontal:spacing.md,marginBottom:0},track:{height:4,borderRadius:2,overflow:"hidden"},fill:{height:"100%"},seekThumb:{position:"absolute",top:-3,width:10,height:10,borderRadius:5,marginLeft:-5},textArea:{flex:1},readingContent:{paddingTop:spacing.sm,paddingBottom:190},sentence:{marginBottom:spacing.sm,paddingHorizontal:2,borderRadius:4},readingAsk:{minHeight:36,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.sm,marginTop:0,flexDirection:"row",alignItems:"center",alignSelf:"flex-end",gap:spacing.xs},readingAskText:{...typography.control},dock:{borderWidth:1,borderRadius:radii.lg,overflow:"hidden",marginBottom:spacing.sm,paddingTop:spacing.xs,elevation:2,shadowColor:"#000",shadowOpacity:.08,shadowRadius:8,shadowOffset:{width:0,height:2}},nowListeningHeader:{minHeight:48,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm},compactListeningHeader:{minHeight:40},nowListeningCopy:{flex:1},nowListeningLabel:{fontSize:13,fontWeight:"800"},nowListeningTitle:{fontSize:12,marginTop:1},controls:{height:58,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.xl},compactControls:{height:50},control:{width:controlSizes.minimumTouch,height:controlSizes.minimumTouch,justifyContent:"center",alignItems:"center"},play:{width:48,height:48,borderRadius:24,justifyContent:"center",alignItems:"center"},playbackMeta:{paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:0},timeText:{fontSize:11,fontWeight:"600"},rateButton:{minHeight:28,flexDirection:"row",alignItems:"center",gap:4},rateText:{fontSize:11,fontWeight:"700"},dockTrack:{height:4,borderRadius:2,overflow:"hidden"},toolRow:{borderTopWidth:1,flexDirection:"row",padding:2},tool:{flex:1,minWidth:0,minHeight:48,borderRadius:radii.md,alignItems:"center",justifyContent:"center",gap:1},toolLabel:{fontSize:10,fontWeight:"700",maxWidth:"100%"},modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.24)",justifyContent:"flex-end"},sheet:{maxHeight:"66%",borderTopLeftRadius:radii.sheet,borderTopRightRadius:radii.sheet,paddingHorizontal:spacing.xl,paddingTop:spacing.sm,paddingBottom:spacing.xl},handle:{width:38,height:4,borderRadius:2,alignSelf:"center",marginBottom:spacing.md},sheetHeader:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:spacing.md},sheetTitle:{...typography.sheetTitle},sheetSubtitle:{fontSize:13,marginTop:3,maxWidth:300},sheetContent:{paddingTop:spacing.lg,paddingBottom:spacing.xl,gap:spacing.lg},setting:{gap:spacing.sm},settingLabel:{fontSize:13,fontWeight:"700",textTransform:"uppercase",letterSpacing:.5},choiceRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},choice:{minHeight:44,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center",flexGrow:1},choiceText:{...typography.control},toggleRow:{minHeight:72,borderWidth:1,borderRadius:radii.md,padding:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.md},toggleCopy:{flex:1},toggleTitle:{...typography.control},toggleDescription:{fontSize:13,marginTop:2},emptyVoices:{fontSize:14,paddingVertical:spacing.sm},voiceChoice:{width:"100%",minHeight:54,borderWidth:1,borderRadius:radii.md,flexDirection:"row",alignItems:"center",padding:spacing.xs},voicePreview:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center"},voiceSelect:{flex:1,minHeight:44,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},voiceName:{...typography.control,fontSize:15},completionBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.45)",alignItems:"center",justifyContent:"center",padding:spacing.xl},completionCard:{width:"100%",maxWidth:420,borderWidth:1,borderRadius:radii.sheet,padding:spacing.xl,alignItems:"center",gap:spacing.md},completionClose:{position:"absolute",right:spacing.sm,top:spacing.sm,width:controlSizes.minimumTouch,height:controlSizes.minimumTouch,alignItems:"center",justifyContent:"center",zIndex:1},completionImage:{width:150,height:132},completionTitle:{...typography.screenTitle,fontSize:26,textAlign:"center"},completionDocument:{fontSize:15,textAlign:"center"},completionMessage:{fontSize:14,lineHeight:20,textAlign:"center"},completionStats:{width:"100%",flexDirection:"row",alignItems:"center",marginVertical:spacing.sm},completionStat:{flex:1,alignItems:"center",gap:spacing.xs},completionValue:{fontSize:21,fontWeight:"800"},completionLabel:{fontSize:13},completionDivider:{width:1,height:44},completionGrid:{width:"100%",flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},completionAction:{width:"48%",flexGrow:1,minHeight:64,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.sm,alignItems:"center",justifyContent:"center",gap:spacing.xs},completionActionText:{fontSize:14,fontWeight:"700"},savedExcerpt:{fontSize:16,lineHeight:24,borderRadius:radii.md,padding:spacing.md,marginTop:spacing.lg},noteInput:{minHeight:104,maxHeight:180,borderWidth:1,borderRadius:radii.md,padding:spacing.md,fontSize:16,lineHeight:23,textAlignVertical:"top",marginTop:spacing.sm},savedActions:{flexDirection:"row",justifyContent:"flex-end",gap:spacing.sm,marginTop:spacing.lg},removeButton:{minHeight:48,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.xl,alignItems:"center",justifyContent:"center"},removeText:{...typography.control},saveButton:{minHeight:48,borderRadius:radii.md,paddingHorizontal:spacing.xxl,alignItems:"center",justifyContent:"center",flex:1},saveText:{...typography.control,color:"#FFF"}
});
