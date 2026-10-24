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

// Weak ownership follows the AuthProvider lifetime. A generation change forgets the prior session.
const noticeSessions = new WeakMap<object, { generation: number; shown: Set<string> }>();
export function claim_allowance_notice(owner: object, generation: number, resetsAt: string) {
  const reset = Date.parse(resetsAt);
  if (!Number.isFinite(reset) || reset <= Date.now()) return false;
  let session = noticeSessions.get(owner);
  if (session?.generation !== generation) {
    session = { generation, shown: new Set() };
    noticeSessions.set(owner, session);
  }
  if (session.shown.has(resetsAt)) return false;
  session.shown.add(resetsAt);
  return true;
}
