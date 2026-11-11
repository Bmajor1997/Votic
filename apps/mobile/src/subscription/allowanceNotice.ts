export type AllowanceNotice = { resetsAt: string; code?: string };
/** The monthly credit allowance (AI_CREDITS_EXHAUSTED) and the server's provider safeguard share one notice. */
const ALLOWANCE_CODES = [
  "AI_CREDITS_EXHAUSTED",
  "AI_MONTHLY_ALLOWANCE",
  "FREE_SUMMARIES_EXHAUSTED",
  "FREE_SCANS_EXHAUSTED",
  "FREE_PDF_PLUS_REQUIRED",
];
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
    if (!ALLOWANCE_CODES.includes(String(result.code))) return;
    const date =
      result.code === "FREE_PDF_PLUS_REQUIRED" ? Date.now() + 86400_000 : Date.parse(String(result.resetsAt));
    if (!Number.isFinite(date)) return;
    for (const listener of started)
      if (listeners.has(listener))
        listener({ resetsAt: new Date(date).toISOString(), code: String(result.code) });
  };
}

/** A limit the app found itself before asking the server (for example, too few Free scan pages for a scan). */
export function announce_allowance_limit(code: string, resetsAt: string) {
  for (const listener of [...listeners]) listener({ resetsAt, code });
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
