import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo,useState } from "react";
import { Pressable,StyleSheet,Text,TextInput,View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { radii,spacing,typography } from "../../src/design/tokens";
import { useDocumentLibrary } from "../../src/documents/DocumentLibraryProvider";
import { useVoticTheme } from "../../src/theme/ThemeProvider";
import { NotesEmptyAnimation } from "../../src/components/EmptyStateIllustrations";

type Filter="all"|"notes"|"saved";
function dateLabel(value:number){return new Date(value).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}

export default function Notes(){
  const {theme}=useVoticTheme();
  const {documents,openDocument}=useDocumentLibrary();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const items=useMemo(()=>documents.flatMap(document=>(document.savedPassages||[]).map(passage=>({document,passage}))).filter(({document,passage})=>{
    if(filter==="notes"&&!passage.note.trim())return false;
    if(filter==="saved"&&passage.note.trim())return false;
    const needle=query.trim().toLocaleLowerCase();
    return !needle||document.title.toLocaleLowerCase().includes(needle)||passage.text.toLocaleLowerCase().includes(needle)||passage.note.toLocaleLowerCase().includes(needle);
  }).sort((a,b)=>b.passage.updatedAt-a.passage.updatedAt),[documents,query,filter]);
  function open(documentId:string,sentenceIndex:number){openDocument(documentId,sentenceIndex);router.push("/reader");}

  return <Screen title="Notes">
    <Text style={[s.intro,{color:theme.mutedText}]}>Everything you save while reading, with a direct path back to the source.</Text>
    <View style={[s.search,{borderColor:theme.border,backgroundColor:theme.surface}]}><Ionicons name="search" size={20} color={theme.mutedText}/><TextInput accessibilityLabel="Search notes" value={query} onChangeText={setQuery} placeholder="Search notes, passages, or documents" placeholderTextColor={theme.mutedText} style={[s.input,{color:theme.text}]}/>{query?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setQuery("")}><Ionicons name="close-circle" size={20} color={theme.mutedText}/></Pressable>:null}</View>
    <View style={s.filters}><FilterButton label="All" value="all" current={filter} onPress={setFilter}/><FilterButton label="Notes" value="notes" current={filter} onPress={setFilter}/><FilterButton label="Saved passages" value="saved" current={filter} onPress={setFilter}/></View>
    {items.length?<View style={s.list}>{items.map(({document,passage})=><Pressable key={document.id+passage.id} accessibilityRole="button" accessibilityLabel={"Open note from "+document.title} accessibilityHint="Returns to this passage in the reader" onPress={()=>open(document.id,passage.sentenceIndex)} style={({pressed})=>[s.card,{borderColor:theme.border,backgroundColor:pressed?theme.surfaceMuted:theme.surface}]}>
      <View style={s.cardTop}><View style={s.documentLine}><Ionicons name={passage.note.trim()?"create-outline":"bookmark"} size={17} color={theme.accent}/><Text numberOfLines={1} style={[s.document,{color:theme.mutedText}]}>{document.title}</Text></View><Text style={[s.date,{color:theme.mutedText}]}>{dateLabel(passage.updatedAt)}</Text></View>
      <Text numberOfLines={4} style={[s.passage,{color:theme.text}]}>{passage.text}</Text>
      {passage.note.trim()?<View style={[s.note,{backgroundColor:theme.surfaceMuted}]}><Text style={[s.noteLabel,{color:theme.accent}]}>YOUR NOTE</Text><Text style={[s.noteText,{color:theme.text}]}>{passage.note}</Text></View>:<Text style={[s.savedLabel,{color:theme.mutedText}]}>Saved passage</Text>}
      <View style={s.source}><Text style={[s.sourceText,{color:theme.accent}]}>Open in Reader</Text><Ionicons name="arrow-forward" size={17} color={theme.accent}/></View>
    </Pressable>)}</View>:<View style={s.empty}>{!query?<NotesEmptyAnimation/>:<Ionicons name="search-outline" size={34} color={theme.mutedText}/>}<Text style={[s.emptyTitle,{color:theme.text}]}>{query?"No matches":"No notes yet"}</Text><Text style={[s.emptyCopy,{color:theme.mutedText}]}>{query?"Try another search or filter.":"Save a passage in the Reader and add a note. It will appear here automatically."}</Text></View>}
  </Screen>;
}
function FilterButton({label,value,current,onPress}:{label:string;value:Filter;current:Filter;onPress:(value:Filter)=>void}){const {theme}=useVoticTheme();const active=value===current;return <Pressable accessibilityRole="radio" accessibilityState={{checked:active}} onPress={()=>onPress(value)} style={[s.filter,{borderColor:active?theme.accent:theme.border,backgroundColor:active?theme.sentenceHighlight:theme.surface}]}><Text style={[s.filterText,{color:active?theme.accent:theme.text}]}>{label}</Text></Pressable>;}
const s=StyleSheet.create({intro:{...typography.body},search:{minHeight:50,borderWidth:1,borderRadius:radii.md,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm},input:{flex:1,fontSize:15,minHeight:48},filters:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},filter:{minHeight:40,borderWidth:1,borderRadius:radii.pill,paddingHorizontal:spacing.md,alignItems:"center",justifyContent:"center"},filterText:{fontSize:13,fontWeight:"700"},list:{gap:spacing.md},card:{borderWidth:1,borderRadius:radii.lg,padding:spacing.lg,gap:spacing.md},cardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:spacing.md},documentLine:{flex:1,flexDirection:"row",alignItems:"center",gap:spacing.xs},document:{flex:1,fontSize:13,fontWeight:"700"},date:{fontSize:12},passage:{fontSize:16,lineHeight:24,fontWeight:"600"},note:{borderRadius:radii.md,padding:spacing.md,gap:spacing.xs},noteLabel:{...typography.eyebrow,fontSize:11},noteText:{fontSize:15,lineHeight:22},savedLabel:{fontSize:13,fontWeight:"700"},source:{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:spacing.xs},sourceText:{fontSize:14,fontWeight:"800"},empty:{alignItems:"center",paddingVertical:spacing.lg,gap:spacing.sm},emptyImage:{width:210,height:192},emptyTitle:{...typography.sectionTitle},emptyCopy:{...typography.body,textAlign:"center"}});
