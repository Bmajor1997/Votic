import { extract_document } from "./document_file_tools.js";

// Runs in its own process (see document_parser.js): reads one document, replies once, and is then killed.
process.once("message", async ({ name, bytes }) => {
  try {
    const text = await extract_document(name, Buffer.from(bytes));
    process.send({ text });
  } catch (error) {
    process.send({ error: { message: String(error?.message || "Document parsing failed."), code: error?.code } });
  }
});
