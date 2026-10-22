import { describe, expect, it, vi } from "vitest";
import { read_imported_text } from "./readImportedText";

// Hoisted by Vitest above the imports: plain text never reaches the server.
vi.mock("../api/voticApi", () => ({ extract_document: vi.fn(), scan_document_image: vi.fn() }));

const bytes = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0)).buffer;

describe("read_imported_text on the phone", () => {
  it("reads a Notepad file saved in the older Windows format instead of refusing it", async () => {
    expect(await read_imported_text("notes.txt", bytes("Caf\xe9 \x93quoted\x94 \x96 done."))).toBe(
      "Café “quoted” – done.",
    );
  });
  it("still refuses a binary file renamed to .txt", async () => {
    await expect(read_imported_text("photo.txt", bytes("\x89PNG\x00\x00\x00\x0dIHDR"))).rejects.toThrow(
      /does not look like text/,
    );
  });
});
