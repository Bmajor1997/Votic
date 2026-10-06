import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";
import { readerType } from "../../reader/readerText";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { automaticNoteTitle, noteTypeLabel } from "../noteMetadata";
import { NoteItem } from "../notesList";
import { useNoteListening } from "../useNoteListening";

const SMART_ACTIONS = [
  ["Summarize", "Summarize this note concisely, using only this note and its saved source passage."],
  [
    "Key Points",
    "What are the important points in this note? Use only this note and its saved source passage.",
  ],
  ["Explain Simply", "Explain this note more simply, using only this note and its saved source passage."],
  [
    "Check My Understanding",
    "Help me check my understanding of this note. Ask one question at a time and wait for my answer before explaining.",
  ],
  [
    "Create Questions",
    "Create study questions based on this note. Keep the answers separate so I can test myself.",
  ],
  [
    "Clean Up Note",
    "Suggest a cleaned-up version of my note, improving clarity and formatting without adding facts or changing its meaning. Show the proposed text for me to review; do not overwrite my note.",
  ],
] as const;

type Props = {
  item: NoteItem | null;
  onClose: () => void;
  onAsk: (item: NoteItem, initialQuestion?: string) => void;
  onEdit: (item: NoteItem) => void;
  onMore: (item: NoteItem) => void;
  onOpenInReader: (item: NoteItem) => void;
};

/** A focused reading, listening, and understanding workspace for one saved note. */
export function NoteViewer(props: Props) {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Modal
      visible={props.item !== null}
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={props.onClose}
    >
      {props.item ? (
        <NoteWorkspace
          key={`${props.item.document.id}/${props.item.passage.id}`}
          {...props}
          item={props.item}
        />
      ) : null}
    </Modal>
  );
}

function NoteWorkspace({ item, onClose, onAsk, onEdit, onMore, onOpenInReader }: Props & { item: NoteItem }) {
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const [toolsOpen, setToolsOpen] = useState(false);
  const hasNote = Boolean(item.passage.note.trim());
  const content = hasNote ? item.passage.note : item.passage.text;
  const { playing, error, toggle } = useNoteListening(content, item.document.playbackRate);
  const readingStyle = readerType(
    accessibility.textSize,
    accessibility.readingSpacing,
    accessibility.readerFont,
    accessibility.textSpacing,
  );
  return (
    <SafeAreaView accessibilityViewIsModal style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close note"
          accessibilityHint="Return to your notebook"
          onPress={onClose}
          style={s.icon}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text numberOfLines={1} style={[s.headerTitle, { color: theme.text }]}>
          {automaticNoteTitle(item.passage)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Note workspace options"
          onPress={() => onMore(item)}
          style={s.icon}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.hero, theme.elevation, { backgroundColor: theme.hero, borderColor: theme.border }]}>
          <Text style={[s.eyebrow, { color: theme.heroMuted }]}>
            {hasNote ? noteTypeLabel(item.passage.noteType).toUpperCase() : "PASSAGE"}
          </Text>
          <Text accessibilityRole="header" style={[s.title, { color: theme.heroText }]}>
            {automaticNoteTitle(item.passage)}
          </Text>
          <Text style={[s.metadata, { color: theme.heroMuted }]}>{item.document.title}</Text>
          <Text style={[s.metadata, { color: theme.heroMuted }]}>
            Last edited {new Date(item.passage.updatedAt).toLocaleString()}
          </Text>
          {item.passage.tags?.length ? (
            <Text style={[s.metadata, { color: theme.heroMuted }]}>
              {item.passage.tags.map((tag) => `#${tag}`).join("  ")}
            </Text>
          ) : null}
        </View>
        <View style={s.actions}>
          <WorkspaceAction
            icon={playing ? "stop" : "headset-outline"}
            label={playing ? "Stop listening" : "Listen"}
            onPress={() => void toggle()}
            primary
          />
          <WorkspaceAction
            icon="sparkles-outline"
            label="Ask Votic"
            accessibilityLabel="Ask Votic about this note"
            onPress={() => onAsk(item)}
          />
          <WorkspaceAction
            icon="create-outline"
            label="Edit"
            accessibilityLabel="Edit this note"
            onPress={() => onEdit(item)}
          />
        </View>
        {playing ? (
          <Text accessibilityLiveRegion="polite" style={[s.metadata, { color: theme.accentText }]}>
            Reading this {hasNote ? "note" : "saved passage"} aloud. Stop to restart from the beginning.
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={[s.metadata, { color: theme.text }]}>
            {error}
          </Text>
        ) : null}
        <View style={[s.paper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Text style={[s.eyebrow, { color: theme.accentText }]}>
            {hasNote ? "YOUR NOTE" : "SAVED PASSAGE"}
          </Text>
          <Text selectable style={[readingStyle, { color: theme.text }]}>
            {content}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Note smart actions"
          accessibilityState={{ expanded: toolsOpen }}
          onPress={() => setToolsOpen(!toolsOpen)}
          style={[s.tools, { borderColor: theme.border }]}
        >
          <Ionicons name="sparkles-outline" size={20} color={theme.accentText} />
          <Text style={[s.actionText, { color: theme.text }]}>Understand & refine</Text>
          <Ionicons name={toolsOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.mutedText} />
        </Pressable>
        {toolsOpen ? (
          <View style={[s.smart, { backgroundColor: theme.brandTint }]}>
            <Text style={[s.metadata, { color: theme.mutedText }]}>
              Explore this note with Ask Votic. Suggestions leave your saved note intact.
            </Text>
            {SMART_ACTIONS.map(([label, prompt]) => (
              <WorkspaceAction
                key={label}
                icon="chatbubble-ellipses-outline"
                label={label}
                onPress={() => onAsk(item, prompt)}
              />
            ))}
          </View>
        ) : null}
        {item.passage.text.trim() ? (
          <View style={[s.source, { borderColor: theme.border }]}>
            {hasNote ? (
              <>
                <Text style={[s.eyebrow, { color: theme.mutedText }]}>SOURCE PASSAGE</Text>
                <Text selectable style={[readingStyle, { color: theme.mutedText }]}>
                  {item.passage.text}
                </Text>
              </>
            ) : null}
            <WorkspaceAction
              icon="book-outline"
              label="Open in Reader"
              accessibilityLabel="Open this passage in Reader"
              onPress={() => onOpenInReader(item)}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkspaceAction({
  icon,
  label,
  accessibilityLabel = label,
  onPress,
  primary = false,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { theme } = useVoticTheme();
  const color = primary ? theme.onAccent : theme.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        {
          backgroundColor: primary ? theme.accent : theme.surfaceMuted,
          borderColor: primary ? theme.accent : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[s.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: controlSizes.icon,
    height: controlSizes.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...typography.control, flex: 1, textAlign: "center" },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.section,
    gap: spacing.xl,
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
  },
  hero: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.screenTitle },
  eyebrow: { ...typography.eyebrow },
  metadata: { fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    minHeight: controlSizes.minimumTouch,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionText: { ...typography.control, flexShrink: 1 },
  paper: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg },
  tools: {
    minHeight: controlSizes.minimumTouch,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  smart: { borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  source: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
});
