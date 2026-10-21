/** Session-only destination, never a persisted draft or an arbitrary redirect URL. */
let pending: "feature" | "bug" | null = null;
export function remember_feedback_form(category: "feature" | "bug") {
  pending = category;
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
