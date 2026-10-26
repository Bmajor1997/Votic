import { Pressable, StyleSheet, Text } from "react-native";
import { SelectionBar } from "../components/SelectionBar";
import { controlSizes } from "../design/tokens";
import { useVoticTheme } from "../theme/ThemeProvider";
import { DOCUMENT_NOUN, useDocumentSelection } from "./useDocumentSelection";

type Selection = ReturnType<typeof useDocumentSelection>;

/** "Select" beside the library count, shown while there are documents to choose and nothing is being chosen. */
export function DocumentSelectButton({ selection, count }: { selection: Selection; count: number }) {
  const { theme } = useVoticTheme();
  if (!count || selection.selecting) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Select documents"
      accessibilityHint="Choose one, several, or all documents to delete"
      onPress={selection.start}
      style={s.button}
    >
      <Text style={[s.label, { color: theme.accentText }]}>Select</Text>
    </Pressable>
  );
}

/** The bar for choosing documents: Select all, Delete and Cancel. */
export function DocumentSelectionBar({ selection, total }: { selection: Selection; total: number }) {
  if (!selection.selecting) return null;
  return (
    <SelectionBar
      count={selection.selectedIds.length}
      total={total}
      noun={DOCUMENT_NOUN}
      prompt="Choose documents to delete"
      onToggleAll={selection.toggleAll}
      onDelete={selection.confirmDelete}
      onCancel={selection.cancel}
    />
  );
}

const s = StyleSheet.create({
  button: { minHeight: controlSizes.minimumTouch, justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "800" },
});
