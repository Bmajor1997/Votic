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
