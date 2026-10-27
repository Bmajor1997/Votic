import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readable_title } from "../../documents/documentDisplay";
import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";
import { reader_type } from "../../reader/readerText";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { automatic_note_title, note_type_label } from "../noteMetadata";
import { note_palette } from "../notePalette";
import { NoteItem } from "../notesList";
import { useNoteListening } from "../useNoteListening";

type Props = {
  item: NoteItem | null;
  onClose: () => void;
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

function NoteWorkspace({ item, onClose, onEdit, onMore, onOpenInReader }: Props & { item: NoteItem }) {
  const { theme } = useVoticTheme();
  const accessibility = useAccessibilityPreferences();
  const colors = note_palette(item.document);
  const hasNote = Boolean(item.passage.note.trim());
  const content = hasNote ? item.passage.note : item.passage.text;
  const { playing, error, toggle } = useNoteListening(content, item.document.playbackRate);
  const readingStyle = reader_type(
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
          {automatic_note_title(item.passage)}
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
        <View
          style={[s.hero, theme.elevation, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[s.eyebrow, { color: colors.detail }]}>
            {hasNote ? note_type_label(item.passage.noteType).toUpperCase() : "PASSAGE"}
          </Text>
          <Text accessibilityRole="header" style={[s.title, { color: colors.ink }]}>
            {automatic_note_title(item.passage)}
          </Text>
          <Text style={[s.metadata, { color: colors.detail }]}>{readable_title(item.document.title)}</Text>
          <Text style={[s.metadata, { color: colors.detail }]}>
            Last edited {new Date(item.passage.updatedAt).toLocaleString()}
          </Text>
          {item.passage.tags?.length ? (
            <Text style={[s.metadata, { color: colors.detail }]}>
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
  source: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
});
