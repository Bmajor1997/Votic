export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, section: 36 } as const;
export const radii = { sm: 10, md: 14, lg: 20, sheet: 28, pill: 999 } as const;
export const controlSizes = { minimumTouch: 48, icon: 52, play: 72 } as const;
export const typography = {
  eyebrow: { fontSize: 12 as const, fontWeight: "700" as const, letterSpacing: 0.8 },
  screenTitle: { fontSize: 30 as const, fontWeight: "800" as const, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 20 as const, fontWeight: "700" as const, letterSpacing: -0.2 },
  body: { fontSize: 17 as const, lineHeight: 27 as const, fontWeight: "400" as const },
  control: { fontSize: 16 as const, fontWeight: "700" as const },
  sheetTitle: { fontSize: 21 as const, fontWeight: "800" as const, letterSpacing: -0.2 },
} as const;
