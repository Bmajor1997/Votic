import { describe, expect, it } from "vitest";
import { passage_heading } from "./passageHeading";

const posting = [
  "Python/SaaS Developer to Build Web-Based AI Regulatory & Compliance Risk Assessment Platform",
  "Job Description",
  "We're building a web-based SaaS assessment tool. It helps enterprises understand risk.",
  "Requirements",
  "Five years of Python. Experience with compliance frameworks.",
].join("\n\n");

describe("passage_heading", () => {
  it("names the heading a passage sits under", () => {
    // Passages: 0 title, 1 "Job Description", 2-3 its sentences, 4 "Requirements", 5-6 its sentences.
    expect(passage_heading(posting, 3)).toBe("Job Description");
    expect(passage_heading(posting, 6)).toBe("Requirements");
    expect(passage_heading(posting, 4)).toBe("Requirements");
  });

  it("looks just past a long title line when nothing above is a heading", () => {
    expect(passage_heading(posting, 0)).toBe("Job Description");
  });

  it("returns null rather than guessing when there is no heading nearby", () => {
    expect(passage_heading("One sentence here. Another sentence there. And a third one.", 1)).toBeNull();
    expect(passage_heading(posting, 99)).toBeNull();
    expect(passage_heading(posting, -1)).toBeNull();
  });

  it("doesn't treat short sentences or labels with colons as headings", () => {
    const text = ["It works.", "Note:", "Details follow here."].join("\n\n");
    expect(passage_heading(text, 2)).toBeNull();
  });
});
