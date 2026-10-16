import { NoteType, SavedPassage } from "../documents/types";

export const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "key-point", label: "Key Point" },
  { value: "question", label: "Question" },
  { value: "definition", label: "Definition" },
];
export function note_type(value?: NoteType) {
  return value || "note";
}
export function note_type_label(value?: NoteType) {
  return NOTE_TYPES.find((item) => item.value === note_type(value))?.label || "Note";
}
export function automatic_note_title(passage: Pick<SavedPassage, "note" | "text" | "title">) {
  const explicit = passage.title?.trim();
  if (explicit) return explicit;
  const source = passage.note.trim() || passage.text.trim();
  const first =
    source
      .split(/[.!?\n]/)
      .map((value) => value.trim())
      .find(Boolean) || "Untitled note";
  return first.length > 54 ? first.slice(0, 51).trimEnd() + "…" : first;
}
export function clean_tags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 30)),
    ),
  ].slice(0, 8);
}
