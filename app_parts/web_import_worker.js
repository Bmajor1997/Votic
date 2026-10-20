import { parentPort, workerData } from "node:worker_threads";
import { clean_webpage_html } from "./web_import.js";

try {
  const page = clean_webpage_html(Buffer.from(workerData.bytes).toString("utf8"));
  parentPort.postMessage({ text: JSON.stringify(page) });
} catch {
  parentPort.postMessage({ error: { message: "That webpage could not be processed safely." } });
}
