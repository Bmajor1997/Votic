import { useState } from "react";
import { AccessibilityInfo, Alert } from "react-native";
import { count_label } from "../components/SelectionBar";

export const DOCUMENT_NOUN = { one: "document", many: "documents" };

/**
 * Choosing documents in the library: one, several, or every document the list is showing, then deleting them
 * together. Deleting asks first and moves them (and their notes) to Recently Deleted, like deleting one document.
 */
export function useDocumentSelection(visibleIds: readonly string[], removeDocument: (id: string) => void) {
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  // Only documents the list still shows count, so a filter or search change never deletes something hidden.
  const selectedIds = chosen.filter((id) => visibleIds.includes(id));
  function start() {
    setSelecting(true);
    setChosen([]);
  }
  function cancel() {
    setSelecting(false);
    setChosen([]);
  }
  function toggle(id: string) {
    setChosen((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function toggleAll() {
    setChosen(selectedIds.length >= visibleIds.length ? [] : [...visibleIds]);
  }
  function confirmDelete() {
    const ids = selectedIds;
    if (!ids.length) return;
    const many = ids.length > 1;
    Alert.alert(
      many ? `Delete ${ids.length} documents?` : "Delete document?",
      `${many ? "These documents and their notes move" : "This document and its notes move"} to Recently Deleted for 30 days, where you can restore them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            ids.forEach(removeDocument);
            cancel();
            AccessibilityInfo.announceForAccessibility(
              `${count_label(ids.length, DOCUMENT_NOUN)} moved to Recently Deleted.`,
            );
          },
        },
      ],
    );
  }
  return { selecting, selectedIds, start, cancel, toggle, toggleAll, confirmDelete };
}
