import { Worker } from "node:worker_threads";

/** Terminate the parser before settling, so abandoned work never outlives its capacity slot. */
export function parse_document_isolated(name, bytes, { timeoutMs = 15_000, signal, workerUrl = new URL("./document_parser_worker.js", import.meta.url) } = {}) {
  if (signal?.aborted) return Promise.reject(new Error("Document processing canceled."));
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { name, bytes },
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const complete = (error, text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      // Worker termination also interrupts synchronous parser loops.
      void worker.terminate().then(() => error ? reject(error) : resolve(text), reject);
    };
    const abort = () => complete(new Error("Document processing canceled."));
    const timer = setTimeout(() => {
      const error = new Error("Document processing took too long. Try a smaller file.");
      error.code = "PARSER_TIMEOUT";
      complete(error);
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", (result) => {
      if (result.error) {
        const error = new Error(result.error.message);
        error.code = result.error.code;
        complete(error);
      } else if (typeof result.text === "string") complete(null, result.text);
      else complete(new Error("Document parsing failed."));
    });
    worker.once("error", (error) => complete(error));
    worker.once("exit", () => { if (!settled) complete(new Error("Document parser stopped unexpectedly.")); });
    if (signal?.aborted) abort();
  });
}
