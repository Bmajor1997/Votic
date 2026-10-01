import { ActivityLog, addAskEvent, addInterval, emptyLog } from "./activityModel";
import { AskCategory } from "./askCategories";

/**
 * Generated statistics for development and design review only. Shown when explicitly turned on
 * in a development build, kept in memory, and never saved over real measurements.
 */
export function sampleActivityLog(documentIds: string[], now = new Date()): ActivityLog {
  const ids = documentIds.length ? documentIds : ["sample-document"];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 75);
  let log = emptyLog(start.getTime());
  let seed = 7;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let offset = 75; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    // Some quiet days, more activity in the evenings and on weekdays.
    if (random() < 0.3) continue;
    const evening = random() < 0.65;
    const hour = evening ? 19 + Math.floor(random() * 3) : 7 + Math.floor(random() * 4);
    const begin = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour,
      Math.floor(random() * 40),
    ).getTime();
    if (begin > now.getTime()) continue;
    const documentId = ids[Math.floor(random() * Math.min(ids.length, 4))];
    const reading = (5 + random() * 25) * 60_000;
    const listening = random() < 0.6 ? (5 + random() * 35) * 60_000 : 0;
    log = addInterval(log, documentId, "reading", begin, begin + reading);
    if (listening)
      log = addInterval(log, documentId, "listening", begin + reading, begin + reading + listening);
    if (random() < 0.4) {
      const categories: AskCategory[] = ["summary", "explanation", "definition", "comparison", "other"];
      const category = categories[Math.floor(random() * categories.length)];
      log = addAskEvent(log, {
        at: begin + 60_000,
        category,
        prompt:
          category === "summary"
            ? "Summarize this document"
            : category === "explanation"
              ? "Explain this section"
              : undefined,
        newConversation: random() < 0.7,
      });
    }
  }
  return log;
}
