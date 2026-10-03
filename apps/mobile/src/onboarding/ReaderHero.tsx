import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";

export type HeroStage = "read" | "listen" | "understand" | "remember";

const PASSAGE =
  "Photosynthesis lets plants turn light energy into food they can use for growth.";
const WORDS = PASSAGE.split(" ");

export function ReaderHero({ stage }: { stage: HeroStage }) {
  const { theme } = useVoticTheme();
  const listening = stage === "listen";
  const understanding = stage === "understand";
  const remembering = stage === "remember";
  const highlightedThrough = stage === "read" ? 4 : listening ? 8 : -1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel(stage)}
      style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={s.documentHeader}>
        <View style={s.documentIdentity}>
          <View style={[s.fileIcon, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="document-text-outline" size={18} color={theme.accent} />
          </View>
          <View>
            <Text style={[s.fileName, { color: theme.text }]}>Biology notes</Text>
            <Text style={[s.fileMeta, { color: theme.mutedText }]}>Study guide · Page 4</Text>
          </View>
        </View>
        {listening ? (
          <View style={[s.listenPill, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="volume-medium" size={14} color={theme.accent} />
            <Text style={[s.listenText, { color: theme.text }]}>1.0×</Text>
          </View>
        ) : null}
      </View>

      <Text style={[s.passage, { color: theme.text }]}>
        {WORDS.map((word, index) => (
          <Text
            key={index}
            style={
              index <= highlightedThrough
                ? {
                    backgroundColor:
                      listening && index === highlightedThrough
                        ? theme.wordHighlight
                        : theme.sentenceHighlight,
                    fontWeight: listening && index === highlightedThrough ? "800" : "600",
                  }
                : undefined
            }
          >
            {word}
            {index < WORDS.length - 1 ? " " : ""}
          </Text>
        ))}
      </Text>

      {listening ? (
        <View style={s.listeningRow}>
          <View style={[s.playButton, { backgroundColor: theme.playButton }]}>
            <Ionicons name="pause" size={13} color={theme.playIcon} />
          </View>
          <View style={s.waveform}>
            {[9, 16, 12, 20, 14, 18, 10, 15].map((height, index) => (
              <View
                key={index}
                style={[s.waveBar, { height, backgroundColor: theme.accent, opacity: index < 5 ? 1 : 0.35 }]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {understanding ? (
        <View style={s.askStack}>
          <View style={[s.question, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="sparkles-outline" size={15} color={theme.accent} />
            <Text style={[s.questionText, { color: theme.text }]}>Explain this simply.</Text>
          </View>
          <View style={[s.answer, { borderColor: theme.border }]}>
            <Text style={[s.answerLabel, { color: theme.accent }]}>Votic</Text>
            <Text style={[s.answerText, { color: theme.text }]}>
              Plants use sunlight to make the energy they need to grow.
            </Text>
          </View>
        </View>
      ) : null}

      {remembering ? (
        <View style={[s.savedNote, { backgroundColor: theme.surfaceMuted }]}>
          <View style={[s.savedIcon, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
          <View style={s.savedCopy}>
            <Text style={[s.savedTitle, { color: theme.text }]}>Saved to Notes</Text>
            <Text numberOfLines={1} style={[s.savedText, { color: theme.mutedText }]}>
              Plants use sunlight to make energy for growth.
            </Text>
          </View>
          <Ionicons name="bookmark" size={17} color={theme.accent} />
        </View>
      ) : null}
    </View>
  );
}

function accessibilityLabel(stage: HeroStage) {
  if (stage === "listen") return "Votic listening to a document and following the words";
  if (stage === "understand") return "Ask Votic explaining a document in simpler language";
  if (stage === "remember") return "An important explanation saved to Votic Notes";
  return "Votic making a document easier to read with a highlighted passage";
}

const s = StyleSheet.create({
  card: {
    minHeight: 232,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: "space-between",
  },
  documentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  documentIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  fileMeta: { fontSize: 11, lineHeight: 15 },
  listenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  listenText: { fontSize: 11, fontWeight: "800" },
  passage: { fontSize: 18, lineHeight: 29 },
  listeningRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: { flex: 1, height: 24, flexDirection: "row", alignItems: "center", gap: 5 },
  waveBar: { width: 3, borderRadius: 2 },
  askStack: { gap: spacing.sm },
  question: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  questionText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  answer: { borderLeftWidth: 2, paddingLeft: spacing.md, gap: 3 },
  answerLabel: { fontSize: 11, lineHeight: 15, fontWeight: "900" },
  answerText: { fontSize: 13, lineHeight: 19 },
  savedNote: {
    minHeight: 58,
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  savedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  savedCopy: { flex: 1, gap: 1 },
  savedTitle: { fontSize: 13, lineHeight: 17, fontWeight: "800" },
  savedText: { fontSize: 11, lineHeight: 15 },
});
