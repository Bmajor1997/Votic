import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DocumentTypeIcon } from "../../components/DocumentTypeIcon";
import { radii, spacing } from "../../design/tokens";
import { VoticDocument } from "../../documents/types";
import { notebookActions } from "../../personalization/suggestions";
import { usePersonalization } from "../../personalization/usePersonalization";
import { useVoticTheme } from "../../theme/ThemeProvider";

/** A notebook's summary and study actions, shown above its notes. */
export function NotebookHeader({
  notebook,
  onBack,
  onAsk,
  onShare,
}: {
  notebook: VoticDocument;
  onBack: () => void;
  /** Opens Ask Votic about this notebook, optionally with a question ready to send. */
  onAsk: (initialQuestion?: string) => void;
  onShare: () => void;
}) {
  const { theme } = useVoticTheme();
  const personalization = usePersonalization();
  const passages = notebook.savedPassages || [];
  const count = (predicate: (passage: (typeof passages)[number]) => boolean) =>
    passages.filter(predicate).length;
  // Chosen from the person's personalization answers, or their legacy purpose if they have none.
  const { studyAction, explainLabel } = notebookActions(personalization.answers, personalization.purpose);
  return (
    <View style={[s.hero, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to all notes"
        onPress={onBack}
        style={s.back}
      >
        <Ionicons name="chevron-back" size={20} color={theme.text} />
        <Text style={[s.backText, { color: theme.text }]}>All Notes</Text>
      </Pressable>
      <View style={s.heading}>
        <DocumentTypeIcon sourceName={notebook.sourceName} size={44} />
        <View style={s.copy}>
          <Text numberOfLines={2} style={[s.title, { color: theme.text }]}>
            {notebook.title}
          </Text>
          <Text style={[s.counts, { color: theme.mutedText }]}>
            {count((p) => Boolean(p.note.trim()))} notes · {count((p) => !p.note.trim())} saved passages
          </Text>
        </View>
      </View>
      <View style={s.stats}>
        <NotebookStat label="Pinned" value={count((p) => Boolean(p.pinned))} />
        <NotebookStat label="Key Points" value={count((p) => p.noteType === "key-point")} />
        <NotebookStat label="Questions" value={count((p) => p.noteType === "question")} />
        <NotebookStat label="Definitions" value={count((p) => p.noteType === "definition")} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ask Votic about ${notebook.title} notebook`}
        onPress={() => onAsk()}
        style={[s.ask, { backgroundColor: theme.accent }]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFF" />
        <Text style={s.askText}>Ask Votic about this notebook</Text>
      </Pressable>
      <View style={s.actions}>
        <NotebookAction icon="share-outline" label="Share notebook" onPress={onShare} />
        <NotebookAction
          icon="sparkles-outline"
          label="Summarize notes"
          onPress={() => onAsk("Summarize my notes from this document")}
        />
        <NotebookAction
          icon={studyAction.icon}
          label={studyAction.label}
          onPress={() => onAsk(studyAction.question)}
        />
        <NotebookAction
          icon="bulb-outline"
          label={explainLabel}
          onPress={() => onAsk("Explain the key ideas in my notes")}
        />
      </View>
    </View>
  );
}

function NotebookStat({ label, value }: { label: string; value: number }) {
  const { theme } = useVoticTheme();
  return (
    <View style={[s.stat, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: theme.mutedText }]}>{label}</Text>
    </View>
  );
}

function NotebookAction({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.action, { borderColor: theme.border }]}
    >
      <Ionicons name={icon} size={17} color={theme.accent} />
      <Text style={[s.actionText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  back: { minHeight: 40, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, fontWeight: "800" },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1 },
  title: { fontSize: 19, fontWeight: "800" },
  counts: { fontSize: 12, marginTop: 3 },
  ask: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  askText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  stat: { minWidth: 74, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  action: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: "700" },
});
