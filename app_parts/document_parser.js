import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The parser's own memory cap, so one huge document can't exhaust the server. */
const PARSER_MEMORY_MB = 256;
/** Only what Node needs to start; the parser never sees API keys or other server secrets. */
const CHILD_ENV_KEYS = ["PATH", "Path", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE", "NODE_ENV"];

export { child_env as child_env_for_test };
function child_env() {
  return Object.fromEntries(CHILD_ENV_KEYS.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
}

/**
 * Parse a document in a separate process. PDF parsing loads a native graphics module, and a native crash there (seen
 * on Windows when a worker thread holding it was torn down) used to end the whole server without a word. In its own
 * process, a crash only ends the parser, and the upload gets a clear error instead. The process is killed before
 * settling, so abandoned work never outlives its capacity slot.
 */
export function parse_document_isolated(name, bytes, { timeoutMs = 15_000, signal, workerUrl = new URL("./document_parser_child.js", import.meta.url) } = {}) {
  if (signal?.aborted) return Promise.reject(new Error("Document processing canceled."));
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(workerUrl), [], {
      execArgv: [`--max-old-space-size=${PARSER_MEMORY_MB}`],
      env: child_env(),
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let settled = false;
    const complete = (error, text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      if (error) reject(error);
      else resolve(text);
    };
    const abort = () => complete(new Error("Document processing canceled."));
    const timer = setTimeout(() => {
      const error = new Error("Document processing took too long. Try a smaller file.");
      error.code = "PARSER_TIMEOUT";
      complete(error);
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    child.once("message", (result) => {
      if (result?.error) {
        const error = new Error(result.error.message);
        error.code = result.error.code;
        complete(error);
      } else if (typeof result?.text === "string") complete(null, result.text);
      else complete(new Error("Document parsing failed."));
    });
    child.once("error", (error) => complete(error));
    child.once("exit", () => {
      if (settled) return;
      const error = new Error("Votic couldn't read this document. Try saving it again, or choose another file.");
      error.code = "PARSER_STOPPED";
      complete(error);
    });
    child.send({ name, bytes: Buffer.from(bytes) });
  });
}
