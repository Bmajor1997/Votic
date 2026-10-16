import { describe, expect, it } from "vitest";
import { readable_ai_text } from "./textReveal";

describe("readable_ai_text", () => {
  it("turns Markdown list dashes into bullets and drops bold markers", () => {
    expect(readable_ai_text("Main idea.\n\n- Louis Braille, a **Frenchman**\n* Six dots\n  - nested")).toBe(
      "Main idea.\n\n• Louis Braille, a Frenchman\n• Six dots\n  • nested",
    );
  });
  it("leaves hyphens inside sentences and ranges alone", () => {
    expect(readable_ai_text("A well-known 1-2 step, not -a list")).toBe("A well-known 1-2 step, not -a list");
  });
});
