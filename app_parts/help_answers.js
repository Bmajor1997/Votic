const HELP_TOPICS = [
  { terms: ["upload", "add document", "open document"], answer: "Choose Add document, select Reading document or Worksheet document, then choose a PDF, Word, TXT, or Markdown file and select Open in reader." },
  { terms: ["worksheet", "checkbox", "blank", "answer"], answer: "Choose Worksheet document during upload. Votic turns recognized checkboxes and answer blanks into controls you can complete while listening." },
  { terms: ["download", "export", "word document"], answer: "In Worksheet mode, use Download text beneath the document title. At the end of listening, the summary and key takeaways can also be downloaded separately or together." },
  { terms: ["wrong document", "close document", "remove document", "replace document"], answer: "Choose Close document at the top and confirm to return to the upload screen, where you can select the correct file." },
  { terms: ["speed", "faster", "slower", "rate"], answer: "Use the speed button on the left side of the listening player. Rates run from 1× through 3× in 0.05× steps, and changing speed leaves playback paused." },
  { terms: ["section", "contents", "heading"], answer: "Choose Sections in the upper-left corner to open the document outline. Selecting a section moves the text and progress position there while keeping playback paused." },
  { terms: ["accessibility", "text size", "spacing", "motion", "enlarge"], answer: "Choose the Aa button beneath playback speed to change document text size, reading spacing, motion, and current-word enlargement." },
  { terms: ["color", "highlight", "contrast", "personalize"], answer: "Choose the color-circle button near the top-right corner. Your selection changes highlights and Votic’s accent color; High contrast is also available." },
  { terms: ["pdf", "scan", "selectable text"], answer: "Votic reads PDFs that contain selectable text directly. For a scanned PDF, it reads the text from the page images with AI text recognition; a very long scan may need to be split into smaller files." },
  { terms: ["summary", "takeaway", "review"], answer: "After a document finishes, open Review what I heard. Summary and Key takeaways are optional and can be downloaded separately or together." },
  { terms: ["keyboard", "shortcut", "help"], answer: "Choose the ? button for keyboard shortcuts. Space controls playback, the arrow keys move between passages, and S opens Sections when a document is active." },
];

// The phone app's built-in answers. They follow the in-app Votic guide (apps/mobile/src/onboarding/voticGuide.ts).
const MOBILE_HELP_TOPICS = [
  { terms: ["upload", "add document", "add a document", "add documents", "new document", "import", "file", "pdf", "word", "epub", "powerpoint"], answer: "Open Documents and choose Upload to add a PDF, Word, PowerPoint, EPUB, RTF, OpenDocument text, HTML, text, or Markdown file, or a photo of a page. You can also import a webpage by its address, or scan printed pages with the camera." },
  { terms: ["scan", "camera", "photo"], answer: "Open Documents, add a document, and choose the camera scan. Take a photo of each page, then choose Use scan, and Votic turns the text into a document you can read and hear." },
  { terms: ["webpage", "website", "link", "url", "article"], answer: "Open Documents, add a document, and choose the webpage option. Paste the article's address, and Votic imports its readable text." },
  { terms: ["listen", "play", "voice", "speed", "faster", "slower", "rate", "read aloud"], answer: "In a document, press play at the bottom to hear it. Votic highlights each word as it is spoken. Open the Listen controls to change speed, preview voices, and choose a voice." },
  { terms: ["note", "bookmark", "save", "passage", "highlight"], answer: "Save an important passage with the bookmark control and add a note. Open Notes to find your saved passages and organize or edit them." },
  { terms: ["ask", "question", "microphone", "voice question", "catch me up", "summar"], answer: "Open Ask Votic from a document to ask about it. Type a question or tap the microphone, and Votic answers from the document and points you to the passage it used. Catch me up summarizes what you have read so far." },
  { terms: ["text size", "spacing", "color", "theme", "dark", "sepia", "accent", "appearance", "pronunciation", "accessibility", "motion", "contrast"], answer: "Settings has Appearance for the app theme and accent, Reading & Listening for text size, spacing, word emphasis, and pronunciation, and Accessibility for High contrast reading and Reduce Motion. In a document, Text changes the size, font, and spacing, and Color changes the page: Light, Dark, Sepia, or High contrast." },
  { terms: ["account", "sign out", "sign in", "delete", "password", "membership", "premium", "subscription"], answer: "Open Settings, then Account & Membership, to see your account and Votic Premium. Sign Out keeps your account; Delete Account permanently removes your sign-in. Manage store subscriptions in the App Store or Google Play." },
  { terms: ["widget", "home screen", "lock screen"], answer: "Add the Votic widgets from your phone's home screen widget picker to continue reading or see your week at a glance." },
  { terms: ["statistic", "progress", "streak", "walkthrough", "tips", "help"], answer: "Open Settings, then Help, to reopen the Votic walkthrough, show tips again, or see your reading Statistics." },
];

export function local_help_answer(question, client = "web") {
  const normalized = String(question || "").trim().toLowerCase();
  const mobile = client === "mobile";
  if (!normalized) return mobile
    ? "Ask me how to add documents, listen, save notes, ask about a document, or change Votic's settings."
    : "Ask me how to upload, listen to, navigate, personalize, complete, or download a document in Votic.";
  const topic = (mobile ? MOBILE_HELP_TOPICS : HELP_TOPICS).find(({ terms }) => terms.some((term) => normalized.includes(term)));
  if (topic) return topic.answer;
  return mobile
    ? "I can help with adding documents, scanning pages, listening and voices, notes, Ask Votic, settings, your account, and widgets. Try asking about one of those parts of Votic."
    : "I can help with uploading documents, playback, sections, worksheets, downloads, colors, accessibility, PDF problems, and listening reviews. Try asking about one of those parts of Votic.";
}

export const VOTIC_HELP_CONTEXT = `You are Ask Votic, a concise support assistant for the Votic document-reading prototype. Answer only questions about using Votic. Votic uploads PDF, DOCX, TXT, and Markdown files; offers Reading and Worksheet modes; reads using browser speech; highlights passages and words; has section navigation, playback speeds from 1x to 3x, a clickable progress bar, accessibility and color settings, worksheet TXT exports, optional AI summary/key-takeaway downloads, and opt-in document questions when AI is connected. User accounts, browser extensions, and cloned voices are not implemented. Never claim a feature exists when it does not. Do not request or expose document contents, passwords, API keys, or other sensitive information. If asked about an unrelated topic, explain that you can only help with Votic.`;

export const VOTIC_MOBILE_HELP_CONTEXT = `You are Ask Votic, a concise support assistant inside the Votic phone app. Answer only questions about using Votic. Votic adds PDF (including scanned PDFs), Word, PowerPoint, EPUB, RTF, OpenDocument text, HTML, text, and Markdown documents and photos of pages (JPEG, PNG, or WebP), imports webpages by address, and scans printed pages with the camera. Its Reader shows documents in Read or Listen mode: it reads aloud with the phone's voices, highlights each spoken word, and offers speed, voice, pronunciation, text size, spacing, and reading colors. Ask Votic answers questions about a document (typed or spoken), summarizes what has been read with Catch me up, and can summarize or save a conversation to Notes. Passages can be bookmarked with notes and organized in Notes. Settings has Appearance, Reading & Listening, Accessibility, Personalization, Help (walkthrough, tips, Statistics), and Account & Membership. People sign in with Apple, Google, or email; Votic Premium is a subscription managed through the App Store or Google Play. Home screen widgets show reading progress. Documents and notes are stored on the phone. Never claim a feature exists when it does not, and if you are unsure, say so and suggest checking Settings, then Help. Do not request or expose document contents, passwords, API keys, or other sensitive information. If asked about an unrelated topic, explain that you can only help with Votic.`;
