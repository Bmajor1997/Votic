/** One MIME list for the document picker, shared-file names, and native Android share registration. */
/** @type {Record<string, string>} */
const IMPORT_TYPES = {
  "text/plain": "txt",
  "text/markdown": "md",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/epub+zip": "epub",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/x-rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
  "text/html": "html",
  "application/xhtml+xml": "html",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

module.exports = { IMPORT_TYPES };
