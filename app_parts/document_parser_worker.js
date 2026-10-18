import { parentPort, workerData } from "node:worker_threads";
import { extract_document } from "./document_file_tools.js";

try {
  const text = await extract_document(workerData.name, Buffer.from(workerData.bytes));
  parentPort.postMessage({ text });
} catch (error) {
  parentPort.postMessage({ error: { message: String(error?.message || "Document parsing failed."), code: error?.code } });
}
