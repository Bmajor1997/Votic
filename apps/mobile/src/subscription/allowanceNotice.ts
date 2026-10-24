export type AllowanceNotice = { resetsAt: string };
type Listener = (notice: AllowanceNotice) => void;
const listeners = new Set<Listener>();

export function subscribe_allowance_notice(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Capture at request START. A response from an old account/session cannot notify its replacement. */
export function allowance_notifier() {
  const started = [...listeners];
  return (result: Record<string, unknown>) => {
    if (result.code !== "AI_MONTHLY_ALLOWANCE" || typeof result.resetsAt !== "string") return;
    const date = Date.parse(result.resetsAt);
    if (!Number.isFinite(date)) return;
    for (const listener of started)
      if (listeners.has(listener)) listener({ resetsAt: new Date(date).toISOString() });
  };
}
