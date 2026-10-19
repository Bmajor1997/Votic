import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { BrandMark } from "../../onboarding/WelcomeMotion";
import { VaticPulse } from "../../../components/animations/VaticPulse";

const SAMPLE = "Your documents become something you can listen to, understand, and explore.";
type Demo = "intro" | "listen" | "ask" | "paywall";
const items: { id: Demo; title: string; subtitle: string }[] = [
  { id: "intro", title: "App introduction", subtitle: "Brand mark and welcome experience" },
  { id: "listen", title: "Text-to-speech", subtitle: "Hear a sample with a live playback indicator" },
  { id: "ask", title: "Ask Vatic", subtitle: "Preview an AI thinking state and example answer" },
  { id: "paywall", title: "Plus & Pro", subtitle: "Explore the existing interactive subscription preview on the paywall" },
];

/** Local, account-free visual QA screen; never purchases or calls the AI service. */
export function MotionShowcase({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const [demo, setDemo] = useState<Demo>("intro");
  const [speaking, setSpeaking] = useState(false);
  const [answer, setAnswer] = useState(false);
  useEffect(() => () => { Speech.stop(); }, []);
  useEffect(() => {
    if (!visible) { Speech.stop(); setSpeaking(false); setAnswer(false); }
  }, [visible]);
  function play() {
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    setSpeaking(true);
    Speech.speak(SAMPLE, { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  }
  return (
    <Modal visible={visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={onClose}>
      <View style={[s.page, { backgroundColor: theme.background }]}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={[s.heading, { color: theme.text }]}>Vatic motion lab</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close animation preview" onPress={onClose} style={s.close}><Ionicons name="close" size={26} color={theme.text}/></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: demo === item.id }} onPress={() => { Speech.stop(); setSpeaking(false); setAnswer(false); setDemo(item.id); }} style={[s.item, { borderColor: demo === item.id ? theme.accent : theme.border, backgroundColor: theme.surface }]}>
            <Text style={[s.itemTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={{ color: theme.mutedText }}>{item.subtitle}</Text>
          </Pressable>)}
          <View style={[s.stage, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {demo === "intro" ? <>
              <BrandMark size={95}/>
              <Text style={[s.title, { color: theme.text }]}>Vatic</Text>
              <Text style={{ color: theme.mutedText }}>Read. Listen. Understand.</Text>
              <Text style={[s.note, { color: theme.mutedText }]}>Native brand preview. Remotion intro video is not yet bundled.</Text>
            </> : null}
            {demo === "listen" ? <>
              <VaticPulse active={speaking} color={theme.accent} size={58}/>
              <Text style={[s.title, { color: theme.text }]}>Listen naturally</Text>
              <Text style={[s.sample, { color: theme.text }]}>{SAMPLE}</Text>
              <Pressable accessibilityRole="button" onPress={play} style={[s.action, { backgroundColor: theme.accent }]}>
                <Text style={s.actionText}>{speaking ? "Stop sample" : "Play sample"}</Text>
              </Pressable>
            </> : null}
            {demo === "ask" ? <>
              <VaticPulse active={!answer} color={theme.accent} size={58}/>
              <Text style={[s.title, { color: theme.text }]}>Ask Vatic</Text>
              <Text style={[s.sample, { color: theme.text }]}>What can Vatic help me do?</Text>
              {answer ? <Text style={[s.sample, { color: theme.mutedText }]}>Example answer: Read, listen to, and ask questions about your documents.</Text> : <Text style={{ color: theme.mutedText }}>Thinking…</Text>}
              <Pressable accessibilityRole="button" onPress={() => setAnswer(value => !value)} style={[s.action, { backgroundColor: theme.accent }]}>
                <Text style={s.actionText}>{answer ? "Reset example" : "Show example answer"}</Text>
              </Pressable>
            </> : null}
            {demo === "paywall" ? <>
              <Ionicons name="sparkles" size={56} color={theme.accent}/>
              <Text style={[s.title, { color: theme.text }]}>Vatic Plus & Pro</Text>
              <Text style={[s.sample, { color: theme.mutedText }]}>More listening, more document imports, and more AI questions. The actual paywall retains native pricing and purchase controls.</Text>
              <Text style={[s.note, { color: theme.mutedText }]}>This is a concept preview, not a checkout or rendered Remotion video.</Text>
            </> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, paddingTop: 45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: "800" },
  close: { padding: 12, minWidth: 48, minHeight: 48 },
  body: { padding: 20, gap: 12, paddingBottom: 48 },
  item: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 },
  itemTitle: { fontSize: 16, fontWeight: "700" },
  stage: { borderWidth: 1, borderRadius: 22, padding: 24, minHeight: 320, alignItems: "center", justifyContent: "center", gap: 18 },
  title: { fontSize: 27, fontWeight: "800", textAlign: "center" },
  sample: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  note: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  action: { minHeight: 48, paddingHorizontal: 24, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#FFFFFF", fontWeight: "700" },
});
