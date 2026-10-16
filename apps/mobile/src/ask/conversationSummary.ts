import { assert_help_request_size, help_request_body, type ExplanationStyle } from "../api/helpRequest";
import { conversation_messages, type AskRequest } from "./askVoticContext";

export const CONVERSATION_SUMMARY_PROMPT =
  "Summarize the supplied conversation between You and Votic as a short recap, however long the conversation is. Start with three sentences on what the conversation was about, then give 3 to 5 bullet points with only the key takeaways and most important points. Combine related questions into one takeaway; do not go through the questions and answers one by one or repeat them. Keep uncertainty where Votic was unsure, and never mention something the conversation did not include. Summarize the conversation, not the underlying document, using only the supplied transcript.";

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
