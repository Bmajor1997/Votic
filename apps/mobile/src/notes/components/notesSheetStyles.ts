import { StyleSheet } from "react-native";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";

/** Styles shared by the Notes bottom sheets (note viewer, editor, filters). */
export const notesSheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.3)", justifyContent: "flex-end" },
  editor: {
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center" },
  editorHeader: { flexDirection: "row", alignItems: "center" },
  editorCopy: { flex: 1 },
  editorTitle: { ...typography.sheetTitle },
  editorDocument: { fontSize: 13, marginTop: 2 },
  close: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    alignItems: "center",
    justifyContent: "center",
  },
});
