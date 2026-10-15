import { assert_help_request_size, help_request_body, type ExplanationStyle } from "../api/helpRequest";
import { conversation_messages, type AskRequest } from "./askVoticContext";

export const CONVERSATION_SUMMARY_PROMPT =
  "Summarize the entire supplied conversation between You and Votic, covering the person's questions, Votic's answers, follow-up clarifications, and key takeaways. Start with one short main-idea sentence, then concise bullet points. Distinguish questions from conclusions and preserve uncertainty. Summarize the conversation, not the underlying document. Use only the supplied transcript.";

/** Send the full transcript as source content, not the API's truncated follow-up history. */
export function conversation_summary_request(
  messages: { role: "user" | "votic"; text: string; fallback?: boolean; summary?: boolean }[],
  explanationStyle: ExplanationStyle = "adaptive",
): AskRequest {
  const transcript = conversation_messages(messages)
    .filter((message) => !message.summary)
    .map((message) => `${message.role === "user" ? "You" : "Votic"}: ${message.text}`)
    .join("\n\n");
  const tooLong =
    "This conversation is too long to summarize in one request. Your conversation has not been shortened or changed.";
  if (transcript.length > 399_000) throw new Error(tooLong);
  const document = {
    title: "Ask Votic conversation",
    sections: [{ heading: "Full conversation", text: transcript }],
  };
  assert_help_request_size(
    help_request_body(CONVERSATION_SUMMARY_PROMPT, document, [], explanationStyle),
    tooLong,
  );
  return {
    document,
    history: [],
    links: [],
  };
}
