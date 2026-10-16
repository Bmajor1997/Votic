/** One honest, request-specific label; no timer pretends to report backend stages. */
export function ask_status(question: string, grounded = false) {
  if (/\bsummar(?:y|ize|ise|izing|ising)\b/i.test(question)) return "Summarizing";
  if (/\b(compare|contrast|connect|relationship|difference)\b/i.test(question)) return "Connecting ideas";
  if (/\b(simple|simply|simplify|plain language|explain)\b/i.test(question)) return "Putting it simply";
  if (grounded && /\b(find|locate|where|which passage|quote)\b/i.test(question)) return "Finding the passage";
  return grounded ? "Reading" : "Thinking";
}
