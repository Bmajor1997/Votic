/** Home-only color treatments; Reader paper and the app's saved accent remain unchanged. */
export type WidgetTone = "chapter" | "activity" | "notes" | "pdf" | "slides" | "book" | "text";
const light = {
  chapter: {
    surface: "#D8E6FF",
    border: "#B8CEF3",
    ink: "#183967",
    detail: "#3E587C",
    art: "#B5CEFA",
    strong: "#245BC2",
    onStrong: "#FFFFFF",
  },
  activity: {
    surface: "#DFF2ED",
    border: "#B7DACE",
    ink: "#164B40",
    detail: "#3E655C",
    art: "#BFDFD3",
    strong: "#176653",
    onStrong: "#FFFFFF",
  },
  notes: {
    surface: "#EEE6FB",
    border: "#D5C5EE",
    ink: "#49316D",
    detail: "#604B76",
    art: "#D9C7F0",
    strong: "#7046A8",
    onStrong: "#FFFFFF",
  },
  pdf: {
    surface: "#FBE7E6",
    border: "#EBC4C1",
    ink: "#6D302F",
    detail: "#754B49",
    art: "#F1C7C3",
    strong: "#A93E3A",
    onStrong: "#FFFFFF",
  },
  slides: {
    surface: "#FCECDD",
    border: "#EBCDB1",
    ink: "#673D20",
    detail: "#705039",
    art: "#F2D0AF",
    strong: "#A45A20",
    onStrong: "#FFFFFF",
  },
  book: {
    surface: "#EAE6FD",
    border: "#CBC3EE",
    ink: "#3E3471",
    detail: "#544B73",
    art: "#CEC5F2",
    strong: "#6150A7",
    onStrong: "#FFFFFF",
  },
  text: {
    surface: "#E1F0F3",
    border: "#BDD9DF",
    ink: "#234D59",
    detail: "#435F67",
    art: "#BFDEE5",
    strong: "#286979",
    onStrong: "#FFFFFF",
  },
} as const;
const dark = {
  chapter: {
    surface: "#17345B",
    border: "#365986",
    ink: "#EDF4FF",
    detail: "#C1D3EE",
    art: "#294D7C",
    strong: "#91B8FF",
    onStrong: "#132C50",
  },
  activity: {
    surface: "#163B35",
    border: "#335E54",
    ink: "#E1F7ED",
    detail: "#B7D7CB",
    art: "#285449",
    strong: "#8BD8BC",
    onStrong: "#153E32",
  },
  notes: {
    surface: "#33274D",
    border: "#584574",
    ink: "#F2EAFE",
    detail: "#D3C2E7",
    art: "#4E3B6C",
    strong: "#C9ADF1",
    onStrong: "#3D2859",
  },
  pdf: {
    surface: "#452C36",
    border: "#70505B",
    ink: "#FFECEF",
    detail: "#E6C2C9",
    art: "#63404B",
    strong: "#F3B4BD",
    onStrong: "#572731",
  },
  slides: {
    surface: "#42332A",
    border: "#705641",
    ink: "#FFF0DE",
    detail: "#E4CBB4",
    art: "#604937",
    strong: "#ECC092",
    onStrong: "#4B321D",
  },
  book: {
    surface: "#2D2C4C",
    border: "#515177",
    ink: "#EFEEFF",
    detail: "#C9C6E9",
    art: "#44446C",
    strong: "#BEB6F2",
    onStrong: "#302855",
  },
  text: {
    surface: "#213A45",
    border: "#405E6B",
    ink: "#E5F5FA",
    detail: "#BCD7E1",
    art: "#345462",
    strong: "#98CEDF",
    onStrong: "#213F4B",
  },
} as const;
export function widgetPalette(isDark: boolean, tone: WidgetTone) {
  return (isDark ? dark : light)[tone];
}
export function documentWidgetTone(sourceName: string): WidgetTone {
  if (/\.pdf$/i.test(sourceName)) return "pdf";
  if (/\.pptx?$/i.test(sourceName)) return "slides";
  if (/\.epub$/i.test(sourceName)) return "book";
  if (/\.docx?$/i.test(sourceName)) return "chapter";
  return "text";
}
