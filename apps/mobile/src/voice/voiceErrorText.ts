import type { VoiceInputPhase } from "../components/KeyboardDictationButton";

/**
 * The voice message shown beside the question box, with one next step. A failed recording that can be retried
 * says how; otherwise the person is reminded they can type, unless the message already says so (the server's
 * transcription failure does), so the hint never appears twice.
 */
export function voice_error_text(message: string, phase: VoiceInputPhase) {
  if (phase === "error") return `${message} Retry transcription or discard the recording.`;
  if (/\btyp(?:e|ing)\b/i.test(message)) return message;
  return `${message} You can still type your question.`;
}
