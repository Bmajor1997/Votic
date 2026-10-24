/** One scanner session becomes one document. Photo names are private, app-owned files. */
export type ScanPage = { id: string; uri: string; text?: string };
export type ScanDraft = { id: string; title: string; pages: ScanPage[] };
export const MAX_SCAN_PAGES = 50;
export function new_scan_draft(): ScanDraft {
  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: `Scanned document - ${new Date().toLocaleDateString()}`,
    pages: [],
  };
}
export function scan_page_id() {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
}
export function move_scan_page(draft: ScanDraft, index: number, direction: -1 | 1): ScanDraft {
  const target = index + direction;
  if (index < 0 || target < 0 || index >= draft.pages.length || target >= draft.pages.length) return draft;
  const pages = [...draft.pages];
  [pages[index], pages[target]] = [pages[target], pages[index]];
  return { ...draft, pages };
}
export function validate_scan_draft(value: unknown): asserts value is ScanDraft {
  const draft = value as ScanDraft;
  if (
    !draft ||
    typeof draft.id !== "string" ||
    !/^scan-[a-z0-9-]{1,100}$/.test(draft.id) ||
    typeof draft.title !== "string" ||
    draft.title.length > 120 ||
    !Array.isArray(draft.pages) ||
    draft.pages.length > MAX_SCAN_PAGES
  )
    throw new Error("Your saved scan could not be read. It has not been overwritten.");
  const ids = new Set<string>();
  for (const page of draft.pages) {
    validate_scan_page(page, ids);
    ids.add(page.id);
  }
}

function validate_scan_page(page: ScanPage, ids: Set<string>) {
  if (
    !page ||
    !/^page-[a-z0-9-]{1,100}\.jpg$/.test(page.id) ||
    ids.has(page.id) ||
    typeof page.uri !== "string" ||
    (page.text !== undefined && (typeof page.text !== "string" || page.text.length > 1_000_000))
  )
    throw new Error("Your saved scan could not be read. It has not been overwritten.");
}
