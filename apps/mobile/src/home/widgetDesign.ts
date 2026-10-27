import { darkCards } from "../design/cardPalette";
export type WidgetTone = "chapter" | "activity" | "notes" | "pdf" | "slides" | "book" | "text";
export function widget_palette(_isDark: boolean, tone: WidgetTone) {
  return darkCards[tone];
}
export function document_widget_tone(sourceName: string): WidgetTone {
  if (/\.pdf$/i.test(sourceName)) return "pdf";
  if (/\.pptx?$/i.test(sourceName)) return "slides";
  if (/\.epub$/i.test(sourceName)) return "book";
  if (/\.docx?$/i.test(sourceName)) return "chapter";
  return "text";
}
