export type ExplanationStyle = "quick" | "simple" | "detailed" | "adaptive";
type HelpDocument = { title: string; sections: { heading: string; text: string }[] };
type HelpHistory = { role: "user" | "assistant"; text: string }[];

/** Matches the server's default JSON body cap; count encoded JSON, not document characters. */
export const MAX_HELP_BODY_BYTES = 500_000;

export function help_request_body(
  question: string,
  document?: HelpDocument,
  history: HelpHistory = [],
  explanationStyle: ExplanationStyle = "adaptive",
  feature: "ask-votic" | "catch-me-up" = "ask-votic",
) {
  return JSON.stringify({
    question,
    client: "mobile",
    ...(feature !== "ask-votic" ? { feature } : {}),
    document,
    ...(history.length ? { history } : {}),
    ...(explanationStyle !== "adaptive" ? { explanationStyle } : {}),
  });
}

export function assert_help_request_size(
  body: string,
  message = "This question and its context are too long to send at once. Try a shorter question or a smaller selection.",
) {
  // Works in native runtimes without TextEncoder. JSON.stringify escapes lone surrogates.
  let bytes = 0;
  for (const character of body) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_HELP_BODY_BYTES) throw new Error(message);
  }
}
