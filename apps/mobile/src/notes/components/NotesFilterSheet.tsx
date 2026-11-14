import { useAccessibilityPreferences } from "../../accessibility/AccessibilityProvider";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "../../design/tokens";
import { useVoticTheme } from "../../theme/ThemeProvider";
import { DateFilter, NotesFilter } from "../notesList";
import { notesSheetStyles as sheet } from "./notesSheetStyles";

const SHOW_CHOICES: { label: string; value: NotesFilter }[] = [
  { label: "All notes", value: "all" },
  { label: "Notes", value: "notes" },
  { label: "Saved passages", value: "saved" },
];
const TYPE_CHOICES: { label: string; value: NotesFilter }[] = [
  { label: "Pinned", value: "pinned" },
  { label: "Key Points", value: "key-point" },
  { label: "Questions", value: "question" },
  { label: "Definitions", value: "definition" },
];
const DATE_CHOICES: { label: string; value: DateFilter }[] = [
  { label: "Any time", value: "all" },
  { label: "Today", value: "today" },
  { label: "7 days", value: "week" },
  { label: "30 days", value: "month" },
];

/** What to show, type, date, and tag filters, kept in a sheet so the Notes list stays uncluttered. */
export function NotesFilterSheet({
  visible,
  on_close,
  filter,
  on_filter_change,
  dateFilter,
  on_date_filter_change,
  tagFilter,
  on_tag_filter_change,
  tags,
  on_reset,
}: {
  visible: boolean;
  on_close: () => void;
  filter: NotesFilter;
  on_filter_change: (filter: NotesFilter) => void;
  dateFilter: DateFilter;
  on_date_filter_change: (dateFilter: DateFilter) => void;
  tagFilter: string | null;
  on_tag_filter_change: (tag: string | null) => void;
  tags: string[];
  on_reset: () => void;
}) {
  const { theme } = useVoticTheme();
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={on_close}
    >
      <View style={sheet.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={on_close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: theme.surface }]}>
          <View style={[sheet.handle, { backgroundColor: theme.border }]} />
          <View style={s.header}>
            <View style={sheet.editorCopy}>
              <Text accessibilityRole="header" style={[sheet.editorTitle, { color: theme.text }]}>
                Filter Notes
              </Text>
              <Text style={[sheet.editorDocument, { color: theme.mutedText }]}>
                Narrow your notes without crowding the workspace.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              onPress={on_close}
              style={sheet.close}
            >
              <Ionicons name="close" size={23} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <FilterSection title="Show">
              {SHOW_CHOICES.map((choice) => (
                <Chip
                  key={choice.value}
                  role="radio"
                  label={choice.label}
                  selected={filter === choice.value}
                  on_press={() => on_filter_change(choice.value)}
                />
              ))}
            </FilterSection>
            <FilterSection title="Type">
              {TYPE_CHOICES.map((choice) => (
                <Chip
                  key={choice.value}
                  role="checkbox"
                  label={choice.label}
                  selected={filter === choice.value}
                  on_press={() => on_filter_change(filter === choice.value ? "all" : choice.value)}
                />
              ))}
            </FilterSection>
            <FilterSection title="Date">
              {DATE_CHOICES.map((choice) => (
                <Chip
                  key={choice.value}
                  role="radio"
                  label={choice.label}
                  selected={dateFilter === choice.value}
                  on_press={() => on_date_filter_change(choice.value)}
                />
              ))}
            </FilterSection>
            {tags.length ? (
              <FilterSection title="Tags">
                <Chip
                  role="button"
                  label="All tags"
                  selected={!tagFilter}
                  on_press={() => on_tag_filter_change(null)}
                />
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    role="button"
                    label={`#${tag}`}
                    selected={tagFilter === tag}
                    on_press={() => on_tag_filter_change(tagFilter === tag ? null : tag)}
                  />
                ))}
              </FilterSection>
            ) : null}
          </ScrollView>
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={on_reset}
              style={[s.reset, { borderColor: theme.border }]}
            >
              <Text style={[s.resetText, { color: theme.text }]}>Reset</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={on_close}
              style={[s.showResults, { backgroundColor: theme.accent }]}
            >
              <Text style={s.showResultsText}>Show Results</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useVoticTheme();
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={s.sectionChoices}>{children}</View>
    </View>
  );
}

/** Type filters toggle (checkbox), dates pick one (radio), tags toggle (button with selected state). */
function Chip({
  role,
  label,
  selected,
  on_press,
}: {
  role: "checkbox" | "radio" | "button";
  label: string;
  selected: boolean;
  on_press: () => void;
}) {
  const { theme } = useVoticTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === "button" ? { selected } : { checked: selected }}
      onPress={on_press}
      style={[
        s.chip,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.sentenceHighlight : theme.surface,
        },
      ]}
    >
      <Text style={[s.chipText, { color: selected ? theme.accentText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center" },
  content: { gap: spacing.lg, paddingBottom: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: "800" },
  sectionChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  reset: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: 14, fontWeight: "800" },
  showResults: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  showResultsText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
