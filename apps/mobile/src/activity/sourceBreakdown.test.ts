import { describe, expect, it } from "vitest";
import { VOTIC_GUIDE_SOURCE_NAME } from "../onboarding/voticGuide";
import { document_origin, source_breakdown } from "./sourceBreakdown";

const time = (documentId: string, reading: number, listening: number) => ({
  documentId,
  reading,
  listening,
  total: reading + listening,
  lastActiveAt: 0,
});

describe("where reading and listening time comes from", () => {
  it("uses the recorded source, and only infers an older document's source when the name is certain", () => {
    expect(document_origin({ origin: "webpage", sourceName: "Braille.txt" })).toBe("webpage");
    expect(document_origin({ sourceName: "Scanned document - Oct 15, 2026.txt" })).toBe("scan");
    expect(document_origin({ sourceName: "page.WEBP" })).toBe("scan");
    expect(document_origin({ sourceName: "report.pdf" })).toBe("file");
    expect(document_origin({ sourceName: VOTIC_GUIDE_SOURCE_NAME })).toBe("guide");
    // An old plain-text name could be an uploaded text file or an imported webpage.
    expect(document_origin({ sourceName: "Braille - Wikipedia.txt" })).toBe("earlier");
  });

  it("totals time per source, largest first, and counts each document once", () => {
    const documents = [
      { id: "a", origin: "file" as const, sourceName: "a.pdf" },
      { id: "b", origin: "webpage" as const, sourceName: "b.txt" },
      { id: "c", origin: "webpage" as const, sourceName: "c.txt" },
      { id: "d", origin: "scan" as const, sourceName: "Scanned document - x.txt" },
    ];
    const result = source_breakdown(
      [time("a", 10, 5), time("b", 20, 0), time("c", 0, 30), time("d", 1, 0), time("gone", 4, 0)],
      documents,
    );
    expect(result.map((source) => [source.kind, source.total, source.documents])).toEqual([
      ["webpage", 50, 2],
      ["file", 15, 1],
      ["earlier", 4, 1],
      ["scan", 1, 1],
    ]);
    expect(result[0]).toMatchObject({ label: "Webpages", reading: 20, listening: 30 });
  });

  it("is empty when nothing was read", () => {
    expect(source_breakdown([], [])).toEqual([]);
  });
});
