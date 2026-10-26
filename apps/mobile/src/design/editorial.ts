import { Platform } from "react-native";

/** Display headings only. Reader content and controls keep the person's chosen, accessible fonts. */
export const editorial = {
  fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  fontWeight: "400" as const,
  letterSpacing: -0.6,
};
