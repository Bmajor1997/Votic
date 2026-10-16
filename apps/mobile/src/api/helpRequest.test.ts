import { expect, it } from "vitest";
import { assert_help_request_size, help_request_body, MAX_HELP_BODY_BYTES } from "./helpRequest";

it("checks the UTF-8 size of serialized JSON, including escaping and supplementary characters", () => {
  for (const text of ["plain", "漢字", "😀", "\ud800", '\n\t\u0000"\\']) {
    const base = help_request_body(text);
    const remaining = MAX_HELP_BODY_BYTES - Buffer.byteLength(base, "utf8");
    const exact = help_request_body(text + "x".repeat(remaining));
    expect(Buffer.byteLength(exact, "utf8")).toBe(MAX_HELP_BODY_BYTES);
    expect(() => assert_help_request_size(exact)).not.toThrow();
    expect(() => assert_help_request_size(help_request_body(text + "x".repeat(remaining + 1)))).toThrow(
      "too long",
    );
  }
});

it("includes the complete context and optional feature/style in the transport body", () => {
  const document = { title: "Guide", sections: [{ heading: "Intro", text: "Focus matters." }] };
  const history = [{ role: "assistant" as const, text: "Earlier answer." }];
  expect(JSON.parse(help_request_body("Catch me up", document, history, "simple", "catch-me-up"))).toEqual({
    question: "Catch me up",
    client: "mobile",
    feature: "catch-me-up",
    document,
    history,
    explanationStyle: "simple",
  });
});
