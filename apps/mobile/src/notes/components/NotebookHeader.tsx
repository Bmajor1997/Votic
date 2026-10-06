import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DocumentTypeIcon } from "../../components/DocumentTypeIcon";
import { radii, spacing } from "../../design/tokens";
import { readableTitle } from "../../documents/documentDisplay";
import { VoticDocument } from "../../documents/types";
import { useVoticPurpose } from "../../personalization/PurposeProvider";
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
  const { purpose } = useVoticPurpose();
  const [toolsOpen, setToolsOpen] = useState(false);
  const passages = notebook.savedPassages || [];
  const notes = passages.filter((passage) => passage.note.trim()).length;
  const saved = passages.length - notes;
  const studyAction =
    purpose === "learning"
      ? { icon: "school-outline" as const, label: "Quiz me", question: "Quiz me on these notes" }
      : purpose === "work"
        ? {
            icon: "checkbox-outline" as const,
            label: "Action items",
            question: "Find the action items and decisions in my notes",
          }
        : purpose === "research"
          ? {
              icon: "flask-outline" as const,
              label: "Key findings",
              question: "Identify the key findings and evidence in my notes",
            }
          : {
              icon: "key-outline" as const,
              label: "Key points",
              question: "Find the most important points in my notes",
            };
  return (
    <View style={s.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to all notes"
        onPress={onBack}
        style={s.back}
      >
        <Ionicons name="chevron-back" size={20} color={theme.accentText} />
        <Text style={[s.backText, { color: theme.accentText }]}>All notebooks</Text>
      </Pressable>
      <View style={[s.hero, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={s.heading}>
          <DocumentTypeIcon sourceName={notebook.sourceName} size={44} />
          <View style={s.copy}>
            <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>
              {readableTitle(notebook.title)}
            </Text>
            <Text style={[s.counts, { color: theme.mutedText }]}>
              {notes} {notes === 1 ? "note" : "notes"} · {saved} saved {saved === 1 ? "passage" : "passages"}
            </Text>
          </View>
        </View>
        <View style={s.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask Votic about ${notebook.title} notebook`}
            onPress={() => onAsk()}
            style={[s.ask, { backgroundColor: theme.accent }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFF" />
            <Text style={s.askText}>Ask Votic</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notebook tools"
            accessibilityState={{ expanded: toolsOpen }}
            onPress={() => setToolsOpen((open) => !open)}
            style={[
              s.tools,
              { borderColor: theme.border, backgroundColor: toolsOpen ? theme.brandTint : theme.surface },
            ]}
          >
            <Text style={[s.actionText, { color: theme.text }]}>Notebook tools</Text>
            <Ionicons name={toolsOpen ? "chevron-up" : "chevron-down"} size={16} color={theme.mutedText} />
          </Pressable>
        </View>
        {toolsOpen ? (
          <View style={[s.actions, { borderTopColor: theme.border }]}>
            <Text style={[s.toolsCopy, { color: theme.mutedText }]}>Work with this notebook</Text>
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
              label={purpose === "learning" ? "Explain key ideas" : "Explain"}
              onPress={() => onAsk("Explain the key ideas in my notes")}
            />
          </View>
        ) : null}
      </View>
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
  container: { gap: spacing.xs },
  hero: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  back: { minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, fontWeight: "800" },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: "800" },
  counts: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  ask: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  askText: { color: "#FFF", fontSize: 14, fontWeight: "800", flexShrink: 1 },
  toolbar: { flexDirection: "row", gap: spacing.sm },
  tools: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  toolsCopy: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  actions: { gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  action: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
});
