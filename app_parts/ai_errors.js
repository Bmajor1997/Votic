export class AiLimitError extends Error {
  constructor(message, code, resetsAt) {
    super(message); this.status = 429; this.headers = { "Retry-After": "60" };
    this.code = code; this.resetsAt = resetsAt;
  }
}
