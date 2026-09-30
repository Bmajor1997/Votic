import { StyleSheet } from "react-native";
import { controlSizes, radii, spacing, typography } from "../../design/tokens";

/** Styles shared by the Reader's bottom sheets and header buttons. */
export const sheetStyles = StyleSheet.create({
  iconButton: {
    width: controlSizes.minimumTouch,
    height: controlSizes.minimumTouch,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.24)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "66%",
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sheetTitle: { ...typography.sheetTitle },
  sheetSubtitle: { fontSize: 13, marginTop: 3, maxWidth: 300 },
  settingLabel: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});
