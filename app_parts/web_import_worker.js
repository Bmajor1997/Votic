import { clean_webpage_html } from "./web_import.js";

// Runs in its own process (see document_parser.js): cleans one webpage, replies once, and is then killed.
process.once("message", ({ bytes }) => {
  try {
    const page = clean_webpage_html(Buffer.from(bytes).toString("utf8"));
    process.send({ text: JSON.stringify(page) });
  } catch {
    process.send({ error: { message: "That webpage could not be processed safely." } });
  }
});
