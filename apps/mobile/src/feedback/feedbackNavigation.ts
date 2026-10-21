type Category = "feature" | "bug";
type Draft = { title: string; description: string };

/** Session-only destination, never a persisted draft or an arbitrary redirect URL. */
let pending: Category | null = null;
/**
 * A draft held in memory while someone signs in again after their session expired, so the sign-in round trip
 * doesn't lose what they wrote. Never written to storage, and only returned to the same account and form.
 */
let held: { uid: string; category: Category; draft: Draft } | null = null;

export function remember_feedback_form(category: Category, keep?: { uid: string; draft: Draft }) {
  pending = category;
  held = keep ? { uid: keep.uid, category, draft: { ...keep.draft } } : null;
}
export function take_feedback_destination() {
  const category = pending;
  pending = null;
  return category === "feature"
    ? ("/feedback/feature" as const)
    : category === "bug"
      ? ("/feedback/bug" as const)
      : null;
}
/** The held draft for this account and form, once. Any other account or form gets nothing, and it is discarded. */
export function take_feedback_draft(category: Category, uid: string | undefined): Draft | null {
  const draft = held && uid && held.uid === uid && held.category === category ? held.draft : null;
  held = null;
  return draft;
}
