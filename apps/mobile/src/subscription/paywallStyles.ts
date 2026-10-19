import { StyleSheet } from "react-native";
import { typography } from "../design/tokens";

/** Text and row styles shared by every paywall section, so the sections can't drift apart. */
export const paywallStyles = StyleSheet.create({
  eyebrow: { ...typography.eyebrow, fontWeight: "800", lineHeight: 18 },
  sectionHeading: { gap: 7, marginTop: 8 },
  sectionTitle: { ...typography.sectionTitle, fontWeight: "800", flexShrink: 1 },
  benefitTitle: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  detail: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  disclosure: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
});
