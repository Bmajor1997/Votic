import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { editorial } from "../design/editorial";
import { BrandMark } from "../onboarding/WelcomeMotion";
import { useVoticTheme } from "../theme/ThemeProvider";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityProvider";

type Props = { visible: boolean; reason: "documents" | "credits"; resetsAt?: string; onClose: () => void };

/** An upgrade invitation; the next screen displays the store's plans and confirms the purchase. */
export function FreeUpgradeSheet({ visible, reason, resetsAt, onClose }: Props) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  const insets = useSafeAreaInsets();
  const reset = resetsAt ? new Date(resetsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? "none" : "slide"} statusBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
          <View style={[s.grabber, { backgroundColor: theme.border }]} />
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.top}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close upgrade offer" onPress={onClose} style={[s.close, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            <View style={s.mark}><BrandMark size={72} arrive /></View>
            <Text style={[s.eyebrow, { color: theme.accentText }]}>DISCOVER VOTIC PLUS</Text>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              {reason === "documents" ? "Make room for more reading" : "Keep asking Votic"}
            </Text>
            <Text style={[s.body, { color: theme.mutedText }]}>
              {reason === "documents"
                ? "You've reached the five saved documents included with Votic Free. Upgrade to save more, or remove a document to make room."
                : `You've used your Free monthly AI credits.${reset ? ` They reset ${reset}.` : ""} Upgrade for a larger monthly allowance.`}
            </Text>
            <View style={[s.card, { backgroundColor: theme.brandTint, borderColor: theme.accent }]}>
              <Text style={[s.cardTitle, { color: theme.text }]}>More with Votic Plus</Text>
              <Text style={[s.cardText, { color: theme.text }]}>✓ Save more than five documents</Text>
              <Text style={[s.cardText, { color: theme.text }]}>✓ More monthly AI credits</Text>
              <Text style={[s.cardText, { color: theme.text }]}>✓ Read, listen, and keep your notes</Text>
            </View>
            <Text style={[s.terms, { color: theme.mutedText }]}>Your documents and notes remain available. See current prices and trial eligibility on the next screen.</Text>
            <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push("/paywall"); }} style={[s.button, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
              <Text style={[s.buttonText, { color: theme.onAccent }]}>Subscribe to Votic Plus</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={[s.button, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.buttonText, { color: theme.text }]}>Continue with Votic Free</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "94%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginTop: 10 },
  content: { padding: 20, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  top: { flexDirection: "row", justifyContent: "flex-end" },
  close: { width: 48, height: 48, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mark: { alignItems: "center", marginTop: -16 },
  eyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  title: { ...editorial, fontSize: 32, lineHeight: 40, textAlign: "center" },
  body: { fontSize: 17, lineHeight: 25, textAlign: "center" },
  card: { borderWidth: 2, borderRadius: 24, padding: 20, gap: 10 },
  cardTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  cardText: { fontSize: 16, lineHeight: 23 },
  terms: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { minHeight: 56, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { fontSize: 17, fontWeight: "800", textAlign: "center" },
});
