/** Opaque text colors: preserve the soft violet on dark screens and deepen it on paper. */
export function ai_shimmer_colors(mode: "light" | "dark" | "sepia") {
  if (mode === "dark") return { blue: "#60A5FA", violet: "#A78BFA" };
  if (mode === "sepia") return { blue: "#1E40AF", violet: "#6D28D9" };
  return { blue: "#2563EB", violet: "#7C3AED" };
}
