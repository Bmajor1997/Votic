import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo,useState } from "react";
import { KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,TextInput,View } from "react-native";
import { Screen,ScrollFadeItem } from "../../src/components/Screen";
import { controlSizes,radii,spacing,typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { SavedPassage,VoticDocument } from "../../src/documents/types";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { NotesEmptyAnimation } from "../../src/components/EmptyStateIllustrations";

type Filter="all"|"notes"|"saved";
type NoteItem={document:VoticDocument;passage:SavedPassage};
const documentColors=["#10B981","#2563EB","#F97316","#7C3AED","#0891B2"];
function documentColor(id:string){return documentColors[[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%documentColors.length];}
function dateLabel(value:number){const date=new Date(value),today=new Date();if(date.toDateString()===today.toDateString())return "Today";const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);if(date.toDateString()===yesterday.toDateString())return "Yesterday";return date.toLocaleDateString(undefined,{month:"short",day:"numeric"});}

export default function Notes(){
  const {theme}=useVoticTheme();
  const {documents,openDocument,savePassage}=useDocumentLibrary();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const [editing,setEditing]=useState<NoteItem|null>(null);
  const [draft,setDraft]=useState("");
  const groups=useMemo(()=>documents.map(document=>{
    const passages=(document.savedPassages||[]).filter(passage=>{
      if(filter==="notes"&&!passage.note.trim())return false;
      if(filter==="saved"&&passage.note.trim())return false;
      const needle=query.trim().toLocaleLowerCase();
      return !needle||document.title.toLocaleLowerCase().includes(needle)||passage.text.toLocaleLowerCase().includes(needle)||passage.note.toLocaleLowerCase().includes(needle);
    }).sort((a,b)=>b.updatedAt-a.updatedAt);
    return {document,passages};
  }).filter(group=>group.passages.length).sort((a,b)=>b.passages[0].updatedAt-a.passages[0].updatedAt),[documents,query,filter]);

  function open(documentId:string,sentenceIndex:number){openDocument(documentId,sentenceIndex);router.push("/reader");}
  function edit(document:VoticDocument,passage:SavedPassage){setEditing({document,passage});setDraft(passage.note);}
  function save(){if(!editing)return;savePassage(editing.document.id,{...editing.passage,note:draft.trim(),updatedAt:Date.now()});setEditing(null);setDraft("");}

  return <Screen title="Notes">
    <View style={[s.search,{backgroundColor:theme.surfaceMuted}]}><Ionicons name="search" size={19} color={theme.mutedText}/><TextInput accessibilityLabel="Search notes" value={query} onChangeText={setQuery} placeholder="Search notes, passages..." placeholderTextColor={theme.mutedText} style={[s.input,{color:theme.text}]}/>{query?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setQuery("")} style={s.clear}><Ionicons name="close-circle" size={20} color={theme.mutedText}/></Pressable>:null}</View>
    <View style={s.filters}><FilterButton label="All" value="all" current={filter} onPress={setFilter}/><FilterButton label="Notes" value="notes" current={filter} onPress={setFilter}/><FilterButton label="Saved passages" value="saved" current={filter} onPress={setFilter}/></View>
    {groups.length?<View style={s.list}>{groups.map(({document,passages})=>{const color=documentColor(document.id),noteCount=passages.filter(passage=>passage.note.trim()).length,savedCount=passages.length-noteCount;return <ScrollFadeItem key={document.id}>
      <View style={[s.group,{borderColor:theme.border,backgroundColor:theme.surface}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${document.title}`} onPress={()=>open(document.id,passages[0].sentenceIndex)} style={({pressed})=>[s.groupHeader,{backgroundColor:pressed?theme.surfaceMuted:"transparent"}]}>
          <View style={[s.docIcon,{backgroundColor:color+(theme.isDark?"28":"14")}]}><Ionicons name="document-text-outline" size={22} color={color}/></View>
          <View style={s.groupCopy}><Text numberOfLines={1} style={[s.documentTitle,{color:theme.text}]}>{document.title}</Text><Text style={[s.counts,{color:theme.mutedText}]}>{noteCount} {noteCount===1?"note":"notes"} · {savedCount} {savedCount===1?"passage":"passages"}</Text></View>
          <Ionicons name="chevron-forward" size={19} color={theme.mutedText}/>
        </Pressable>
        {passages.map(passage=><View key={passage.id} style={[s.noteRow,{borderTopColor:theme.border}]}>
          <View style={[s.accent,{backgroundColor:passage.note.trim()?"#F59E0B":color}]}/>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open passage from ${document.title}`} onPress={()=>open(document.id,passage.sentenceIndex)} style={({pressed})=>[s.noteMain,{opacity:pressed?.68:1}]}>
            <Text style={[s.noteMeta,{color:theme.mutedText}]}>{passage.note.trim()?"Note":"Saved passage"} · {dateLabel(passage.updatedAt)}</Text>
            <Text numberOfLines={3} style={[s.noteText,{color:theme.text}]}>{passage.note.trim()||passage.text}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={passage.note.trim()?"Edit note":"Add a note"} onPress={()=>edit(document,passage)} style={s.more}><Ionicons name="ellipsis-horizontal" size={20} color={theme.mutedText}/></Pressable>
        </View>)}
      </View>
    </ScrollFadeItem>;})}</View>:<View style={s.empty}>{!query?<NotesEmptyAnimation/>:<Ionicons name="search-outline" size={34} color={theme.mutedText}/>}<Text style={[s.emptyTitle,{color:theme.text}]}>{query?"No matches":"No notes yet"}</Text><Text style={[s.emptyCopy,{color:theme.mutedText}]}>{query?"Try another search or filter.":"Save a passage in the Reader and add a note. It will be organized here by document."}</Text></View>}

    <Modal visible={editing!==null} transparent animationType="slide" onRequestClose={()=>setEditing(null)}><KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={s.backdrop}><Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={()=>setEditing(null)} style={StyleSheet.absoluteFill}/><View accessibilityViewIsModal style={[s.editor,{backgroundColor:theme.surface}]}><View style={[s.handle,{backgroundColor:theme.border}]}/><View style={s.editorHeader}><View style={s.editorCopy}><Text style={[s.editorTitle,{color:theme.text}]}>{editing?.passage.note.trim()?"Edit note":"Add a note"}</Text><Text numberOfLines={1} style={[s.editorDocument,{color:theme.mutedText}]}>{editing?.document.title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close note editor" onPress={()=>setEditing(null)} style={s.close}><Ionicons name="close" size={23} color={theme.text}/></Pressable></View><Text numberOfLines={3} style={[s.excerpt,{color:theme.mutedText,backgroundColor:theme.surfaceMuted}]}>{editing?.passage.text}</Text><TextInput autoFocus accessibilityLabel="Note text" value={draft} onChangeText={setDraft} placeholder="Write your note..." placeholderTextColor={theme.mutedText} multiline maxLength={2000} style={[s.noteInput,{color:theme.text,borderColor:theme.border,backgroundColor:theme.background}]}/><Pressable accessibilityRole="button" accessibilityLabel="Save note" onPress={save} style={({pressed})=>[s.save,{backgroundColor:theme.accent,opacity:pressed?.78:1}]}><Text style={s.saveText}>Save note</Text></Pressable></View></KeyboardAvoidingView></Modal>
  </Screen>;
}

function FilterButton({label,value,current,onPress}:{label:string;value:Filter;current:Filter;onPress:(value:Filter)=>void}){const {theme}=useVoticTheme();const active=value===current;return <Pressable accessibilityRole="radio" accessibilityState={{checked:active}} onPress={()=>onPress(value)} style={[s.filter,{borderColor:active?theme.accent:theme.border,backgroundColor:active?theme.sentenceHighlight:theme.surface}]}><Text style={[s.filterText,{color:active?theme.accent:theme.text}]}>{label}</Text></Pressable>;}

const s=StyleSheet.create({search:{minHeight:46,borderRadius:radii.md,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm},input:{flex:1,minHeight:44,fontSize:14},clear:{width:controlSizes.minimumTouch,height:controlSizes.minimumTouch,alignItems:"center",justifyContent:"center"},filters:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},filter:{minHeight:38,borderWidth:1,borderRadius:radii.pill,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center"},filterText:{fontSize:13,fontWeight:"700"},list:{gap:spacing.md},group:{borderWidth:1,borderRadius:radii.lg,overflow:"hidden"},groupHeader:{minHeight:66,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm},docIcon:{width:40,height:40,borderRadius:11,alignItems:"center",justifyContent:"center"},groupCopy:{flex:1},documentTitle:{fontSize:15,fontWeight:"800"},counts:{fontSize:12,marginTop:3},noteRow:{minHeight:94,borderTopWidth:1,flexDirection:"row",alignItems:"stretch",paddingVertical:spacing.sm,paddingLeft:spacing.md},accent:{width:3,borderRadius:2,marginVertical:3,marginRight:spacing.sm},noteMain:{flex:1,justifyContent:"center",gap:5},noteMeta:{fontSize:12,fontWeight:"600"},noteText:{fontSize:14,lineHeight:20},more:{width:controlSizes.minimumTouch,alignItems:"center",justifyContent:"flex-start",paddingTop:2},empty:{alignItems:"center",paddingVertical:spacing.lg,gap:spacing.sm},emptyTitle:{...typography.sectionTitle},emptyCopy:{...typography.body,textAlign:"center"},backdrop:{flex:1,backgroundColor:"rgba(0,0,0,.3)",justifyContent:"flex-end"},editor:{borderTopLeftRadius:radii.sheet,borderTopRightRadius:radii.sheet,paddingHorizontal:spacing.xl,paddingTop:spacing.sm,paddingBottom:spacing.xxl,gap:spacing.md},handle:{width:38,height:4,borderRadius:2,alignSelf:"center"},editorHeader:{flexDirection:"row",alignItems:"center"},editorCopy:{flex:1},editorTitle:{...typography.sheetTitle},editorDocument:{fontSize:13,marginTop:2},close:{width:controlSizes.minimumTouch,height:controlSizes.minimumTouch,alignItems:"center",justifyContent:"center"},excerpt:{borderRadius:radii.md,padding:spacing.md,fontSize:13,lineHeight:19},noteInput:{minHeight:130,maxHeight:260,borderWidth:1,borderRadius:radii.md,padding:spacing.md,fontSize:16,lineHeight:23,textAlignVertical:"top"},save:{minHeight:50,borderRadius:radii.md,alignItems:"center",justifyContent:"center"},saveText:{color:"#FFF",fontSize:16,fontWeight:"800"}});
