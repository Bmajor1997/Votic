import { expect, it } from "vitest";
import { conversation_summary_request } from "./conversationSummary";

it("includes every question and full answer beyond follow-up history limits", () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? ("votic" as const) : ("user" as const),
    text: `${i}: ` + "words ".repeat(500),
  }));
  const request = conversation_summary_request([
    ...messages,
    { role: "votic", text: "Daily limit", fallback: true },
  ]);
  const transcript = request.document!.sections[0].text;
  for (const message of messages) expect(transcript).toContain(message.text);
  expect(transcript).not.toContain("Daily limit");
  expect(request.history).toEqual([]);
});

it("does not silently summarize only the latest part of an oversized conversation", () => {
  expect(() => conversation_summary_request([{ role: "user", text: "x".repeat(400_000) }])).toThrow(
    "not been shortened",
  );
});

it.each(["漢".repeat(200_000), "😀".repeat(130_000), "\n".repeat(260_000), "\u0000".repeat(90_000)])(
  "rejects a character-valid conversation whose encoded request exceeds the server cap",
  (text) => {
    expect(text.length).toBeLessThan(399_000);
    expect(() => conversation_summary_request([{ role: "votic", text }], "detailed")).toThrow(
      "not been shortened or changed",
    );
  },
);

it("preserves full multibyte conversations that fit and excludes previous summaries", () => {
  const text = "漢".repeat(100_000);
  const request = conversation_summary_request([
    { role: "user", text: "Explain this" },
    { role: "votic", text },
    { role: "votic", text: "Old summary", summary: true },
  ]);
  expect(request.document!.sections[0].text).toBe(`You: Explain this\n\nVotic: ${text}`);
});
