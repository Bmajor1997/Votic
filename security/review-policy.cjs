const BOT_ID = 199175422;

function evaluate_review({ head, comments, reviews, threads }) {
  const summaries = comments.filter(item => item.user?.id === BOT_ID && item.user?.type === "Bot" && item.body?.startsWith("<!-- codex-pull-request-review-summary -->"))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  let state;
  for (const item of summaries) {
    const match = item.body?.match(/<!-- codex-review-state:v1 ([\s\S]*?) -->/);
    if (match) { state = JSON.parse(match[1]).code_review; break; }
  }
  const current = state?.commit_sha === head && state?.status === "completed";
  const receipt = reviews.some(item => item.user?.id === BOT_ID && item.user?.type === "Bot" && item.commit_id === head && item.state !== "DISMISSED");
  const unresolved = threads.filter(thread => !thread.isResolved);
  // A no-findings review can have a summary/👍 without a formal review receipt.
  const completed = current && (receipt || state.has_any_findings === false);
  const reasons = [];
  if (!completed) reasons.push("Codex must complete a review of the current PR head. After a push, request @codex review.");
  if (unresolved.length) reasons.push(`${unresolved.length} review conversation(s) still need resolution.`);
  return { completed, ready: completed && unresolved.length === 0, reasons, reviewed: state?.commit_sha || null, unresolved: unresolved.length };
}
module.exports = { evaluate_review };
