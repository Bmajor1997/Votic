# Votic

A text-to-speech document reader prototype focused on making documents easier to read, listen to, follow, and understand.

## What Each Place Contains

- `app_parts/` contains the JavaScript pieces that make Votic work.
  - `votic_screen.js` controls what happens on the Votic screen.
  - `document_tools.js` turns document text into sections, sentences, words, progress, and reviews.
  - `document_file_tools.js` reads PDF and Word files.
  - `help_answers.js` contains answers for Votic Help.
- `code_checks/` contains automatic checks for Votic's code.
- `browser_checks/` contains checks that use Votic like a person using a web browser.
- `votic_server.js` starts Votic and answers browser requests.
- `votic_home_page.html` contains the parts shown on the main web page.
- `main_look.css` controls Votic's main colors, sizes, and layout.
- `easy_to_read_look.css` controls optional accessibility styles.
- `browser_check_settings.js` tells Playwright how to run the browser checks.
- `package.json` tells Node which packages and commands Votic needs.
- `package-lock.json` records the exact package versions installed for Votic.

> **Current status:** Votic is transitioning to a mobile-first product. The React Native/Expo mobile client in `apps/mobile/` is the primary app; the dependency-light web prototype remains intact and its server (`votic_server.js`) also serves the mobile app's document extraction and AI features.

## Project Structure

- `apps/mobile/` contains the React Native/Expo mobile application (TypeScript, expo-router).
  - `app/(tabs)/` contains the Home, Documents, Notes, and Settings tabs, plus a hidden Ask tab.
  - `app/reader.tsx` is the Reader: reading, optional listening with synchronized highlighting, and saving passages and notes.
  - `app/assistant.tsx` is Ask Votic, which answers questions about the open document or selected notes.
  - `app/review.tsx` and `app/recap.tsx` are the end-of-document review and the weekly recap.
  - `src/ask/` builds Ask Votic requests: which document or notes to send, relevant excerpts of long documents, conversation history, and where answers link and save.
  - `src/documents/` contains the document library, its on-device storage, and import validation.
  - `src/reader/` contains the Reader's text, progress, and voice helpers, and its sheets and controls.
  - `src/notes/` contains note metadata, Notes filtering and grouping, the Notes context sent to Ask Votic, and the Notes sheets and cards.
  - `src/api/` talks to the Votic server.
  - `src/theme/`, `src/accessibility/`, `src/personalization/`, and `src/onboarding/` contain appearance, accessibility preferences, personalization (purpose, explanation style, default listening speed), and onboarding: the Welcome and sign-in screens' building blocks, the personalization steps, the Getting Started card, the Votic guide document, and in-context Reader tips.
  - `src/auth/` contains Firebase sign-in (email, Google, and Sign in with Apple) behind a small interface that tests replace with an in-memory fake.
  - `src/components/` contains reusable mobile UI components.
  - `tests/` contains component and integration tests (Jest with React Native Testing Library); pure-logic tests sit next to their code in `src/` and run in Vitest.
- The existing root web files remain the working web prototype during the mobile transition. They will move into `apps/web/` only after the mobile foundation is stable, to avoid breaking working functionality during the restructure.
- `packages/shared/` is reserved for platform-neutral business logic reviewed as safe to share across mobile, web, and future desktop clients.
- `.github/` continues to contain repository automation and quality/security checks.

### Mobile navigation decision

The mobile client uses bottom navigation for four primary destinations: **Home**, **Documents**, **Notes**, and **Settings**. The Reader and Ask Votic open as dedicated screens rather than occupying permanent tabs; Ask Votic is also reachable from Home, the Reader, and Notes. This keeps high-frequency destinations visible on phones and leaves room for future areas without forcing a navigation rewrite.

### Mobile-first implementation status

Implemented: the document library with collections, TXT/Markdown import on the device and PDF/Word/PowerPoint/EPUB extraction through the Votic server; the Reader with optional text-to-speech, word highlighting, voice choice, and 0.5×–4× speed in 0.1× steps; saved passages and Notes with titles, types, tags, pins, filters, sharing, and notebooks; Ask Votic about a document or selected notes; the completion review and weekly recap; appearance, accessibility, and personalization; required accounts (email, Google, Sign in with Apple through Firebase); and onboarding: Welcome, sign-in, four skippable personalization steps, a Getting Started card on Home, the Votic guide document, and one-time tips beside the Reader's Listen, Bookmark, and Ask Votic controls. The library is stored on the device, with document text kept separately from frequently changing progress and notes.

Not yet implemented: syncing preferences and the library across devices (both stay on the device), background playback and lock-screen controls, and richer document navigation (real headings rather than passage numbers). Existing working web behavior should be reused or adapted rather than rewritten without a reason.

### Run the mobile app

From `apps/mobile/`, install once with `npm install`, then run `npm start` (Expo). Start the Votic server from the repository root with `npm start` so a development build on the same network can reach it on port 4173. Before pushing mobile changes, run `npm run test:reliability` (Vitest), `npm run test:components` (Jest), `npm run typecheck`, `npm run lint`, and `npm run format:check` (or `npm run format` to fix formatting).

### Statistics: what Votic measures

Statistics (from Home's weekly summary or Settings) uses measurements recorded on the device in `src/activity/`. Nothing is sent to a server or an analytics service, and older activity is not reconstructed: the page says when measurement began on the device.

- **Listening time** is elapsed time while narration is playing and Votic is in the foreground, so it reflects the chosen speed and excludes pauses.
- **Reading time** counts while the Reader is open and the person is engaged (scrolling, touching the page, or using a control), and stops two minutes after the last interaction. It is an estimate: Votic cannot tell whether someone is looking at a still page.
- **No double counting:** while narration plays, the time is listening only.
- **Background and interruptions:** time with the app in the background is excluded. The Reader checks in every 10 seconds; a longer gap (for example a locked phone without a background event) is treated as a suspension and not counted. At most about 10 seconds can be lost if the app is closed abruptly.
- **Days and time zone:** time is stored per local hour in the device's time zone, so a session crossing midnight is split between the two days.
- **Active day:** at least one minute of reading or listening. A **streak** is consecutive active days ending today, or yesterday if today has no activity yet.
- **Ask Votic:** a *question* is each message sent (a retry of a failed message is not counted again); a *conversation* starts with the first question after Ask Votic opens with no messages. Question types (summaries, explanations, comparisons, definitions, other) come from simple word rules on the device. Only the type, the time, and the label of a built-in suggestion are kept; typed question text is never stored for Statistics.
- **Documents:** *Most read* ranks by reading plus listening time in the period. Completion is the existing reading position; re-reading does not count as finishing again.
- **Insights** need at least 30 minutes on 3 different days in the period; *most active day of the week* also needs a month or longer, and comparisons need 10 minutes in both periods. "Most active" describes usage, not productivity.
- **Not yet covered:** background playback (Votic does not play narration in the background yet) and syncing statistics across devices.
- Development builds can show generated sample statistics from a switch at the bottom of Statistics. They are kept in memory and never replace real measurements.
### Accounts

Votic requires an account. The app signs people in with Firebase Authentication; without Firebase settings, Welcome explains that sign-in isn't set up, and only development builds offer "Continue without an account".

1. In the Firebase console, create a project, add an iOS and an Android app, and turn on the **Email/Password**, **Google**, and **Apple** sign-in providers.
2. Set these before `npm start` or an EAS build (they are read at build time):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID` | The web app config from Firebase project settings. Email sign-in works with only these, including in Expo Go. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | The Web client ID from Firebase's Google provider. Shows **Continue with Google**. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | The iOS OAuth client ID. |
| `GOOGLE_IOS_URL_SCHEME` | The reversed iOS client ID (`com.googleusercontent.apps.…`); `app.config.js` adds the Google Sign-In plugin when it is set. |

3. Google and Apple sign-in use native modules, so they need a development or release build (`npx expo run:ios`, `npx expo run:android`, or EAS), not Expo Go. Sign in with Apple also needs the capability on the iOS bundle ID and the Apple provider's Services ID and key in Firebase.
4. Set `FIREBASE_PROJECT_ID` on the Votic server so every `/api/*` request must carry a valid Firebase ID token. Each signed-in account then gets its own `VOTIC_AI_CLIENT_DAILY_LIMIT` allowance instead of sharing one per network address.

Settings includes **Sign out** and **Delete account**. Documents and notes stay on the device either way.
## Run the existing web prototype

Requires Node.js 20 or newer. Install the project dependencies once:

```bash
npm install
npm start
```

Open `http://localhost:4173`. The prototype uses the browser's built-in speech synthesis and keeps the initial voice selection intentionally simple.

Run the model and document-processing tests with `npm test`. Run the real Edge interface checks with `npm run test:browser`.

The prototype includes the document reader, TXT/Markdown/PDF/DOCX ingestion, heading-based section navigation, sentence and word follow-along, text-aware previous/next controls, speed selection, the proportional section-dot timeline, and local resume state. Word extraction preserves headings, tables, ordered lists, and bulleted lists. PDF cleanup removes repeated page headers/footers and page numbers when page boundaries are available, repairs common ligatures, and reconnects words split by line-end hyphenation. Uploaded documents open directly in reading mode. Pausing or opening a listening control preserves the highlighted word, so playback resumes from that position instead of restarting the sentence. Returning listeners recover their document and exact position in a paused state, with explicit Resume and Start over actions. Scanned-PDF OCR, preserving the exact layout of the original DOCX, and server-backed speech are intentionally deferred to later slices.

Finishing a document reveals one optional **Review what I heard** action. Votic immediately shows a local section-based review and, when `OPENAI_API_KEY` is configured, offers an explicit **Generate AI review** action. That action sends the current document text to the OpenAI Responses API, requests a structured summary and three to eight key takeaways, and sets `store: false`; if the request is unavailable or invalid, the local review remains in place. The listener can include either review component or both and download them separately or together as text files. Set `OPENAI_REVIEW_MODEL` to choose a review model, or let it use `OPENAI_MODEL`/the application default.

**Ask Votic** provides built-in product guidance without needing AI. When a document is open, the listener may explicitly select **Use the current document to answer this question**. If AI is connected, Votic sends that question and document text in a stateless `store: false` request, answers only from the supplied document, and can offer a verified link to the most relevant document section. Set `OPENAI_DOCUMENT_MODEL` to choose a document-question model, or let it use `OPENAI_MODEL`/the application default.

Playback speed is adjustable in 0.1× increments across Votic's planned 0.5× through 6× range. The mobile reader uses the same normalized rate model, avoiding floating-point display artifacts. Opening the compact, scrollable speed menu pauses playback, and selecting a rate leaves playback paused.

Follow-along highlighting can be personalized with Warm orange, Blue, Green, Purple, and High contrast presets. Each preset coordinates the current-passage background with the stronger active-word color, and the preference is remembered across documents.

## Deploying the Votic server

The mobile app uses `votic_server.js` for document extraction and AI features. Serve it over HTTPS (for example behind a load balancer) and configure it with environment variables:

Use Node 24+. See [OpenAI backend setup](docs/openai-backend.md) for secure key entry, persistent token/cost accounting, monthly allowances, and the voice-question foundation. `gpt-6-luna` is the initial Responses model. Production AI requires `FIREBASE_PROJECT_ID` and `VOTIC_AI_USAGE_DB` on a private persistent volume.

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | unset | Enables AI help, document questions, and reviews. |
| `VOTIC_AI_DAILY_LIMIT` | `1000` | Server-wide cap on paid AI calls per UTC day. When reached, help falls back to built-in answers and reviews report the limit. |
| `VOTIC_AI_CLIENT_DAILY_LIMIT` | `100` | Cap on paid AI calls per client address per UTC day, so one client cannot use up the server-wide cap for everyone. |
| `FIREBASE_PROJECT_ID` | unset | Requires a signed-in Votic account (a Firebase ID token in `Authorization: Bearer`) on every `/api/*` request, and applies the per-client AI limit per account. See [Accounts](#accounts). |
| `VOTIC_CLIENT_KEYS` | unset | Comma-separated keys (16+ characters). When set, every `/api/*` request must send one in `X-Votic-Client-Key`. List two keys while rotating. The web prototype does not send a key, so leave this unset if it must use the same server. |
| `VOTIC_TRUST_PROXY` | off | The number of proxies in front of the server that append `X-Forwarded-For` (`true` means `1`), so rate limits apply per user instead of per proxy. Behind a CDN and a load balancer, use `2`. Set it only when every request passes through those proxies. |
| `VOTIC_RATE_LIMIT`, `VOTIC_HELP_RATE_LIMIT`, `VOTIC_EXTRACT_RATE_LIMIT`, `VOTIC_REVIEW_RATE_LIMIT` | 120 / 20 / 10 / 10 | Requests per client per `VOTIC_RATE_WINDOW_MS` (60 s). |

Build the mobile app with `EXPO_PUBLIC_VOTIC_API_URL` set to the server's `https://` address and `EXPO_PUBLIC_VOTIC_CLIENT_KEY` set to one of the server's client keys. Release builds refuse to run AI or extraction requests without an HTTPS address; development builds fall back to the computer running Expo on port 4173.

A client key ships inside the app, so it filters casual abuse but is not a secret. Daily attempt caps supplement durable per-account monthly token/cost allowances and the global monthly budget. Production requires Firebase authentication and a persistent ledger. See the linked setup guide for deployment limits and reconciliation of uncertain provider calls.

## Product Hypothesis

People already use text-to-speech tools for studying, work, accessibility, long-form reading, multitasking, and listening on the go. Existing products can generate good speech, but users may still struggle with document parsing, navigation, reliability, confusing interfaces, and understanding complex documents through audio.

The core hypothesis is:

> **Users may value a text-to-speech reader that makes documents genuinely easy to listen to—not just one that generates realistic speech.**

The initial product should focus on the reading experience rather than trying to compete with speech-model companies on raw voice-generation technology.

## Who This Could Help

Potential users include:

- People who prefer listening over reading
- Students and lifelong learners
- Professionals working through long documents
- People who listen while commuting, exercising, or multitasking
- Blind and low-vision users
- People with dyslexia, ADHD, eye strain, or other reading-related needs
- Anyone who wants an easier way to consume written information

The product should be broadly useful while following strong accessibility principles from the beginning.

## Prototype Goal

The first prototype should answer one question:

> **Can we create a listening experience that testers prefer because it is simpler, cleaner, more reliable, or easier to follow than their current approach?**

The prototype is not intended to be a full Speechify, NaturalReader, ElevenReader, or Voice Dream competitor.

## Proposed v0 Scope

The exact prototype scope will be adjusted based on tester feedback, but the current working scope is intentionally small.

### Core capabilities

- Upload a document without entering text into a form
- Upload a PDF
- Upload a DOCX document
- Extract readable text
- Perform basic document cleanup
- Convert text to speech
- Use the founder's voice as the initial product voice through an existing TTS/voice provider
- Play and pause audio
- Skip backward and forward
- Change playback speed
- Show reading/listening progress
- Resume from the user's previous position where practical
- Provide an accessible, low-complexity interface

### Early document-processing experiments

The prototype may begin recognizing simple document structure such as:

- Titles
- Headings
- Paragraphs
- Lists
- Repeated headers and footers
- Page numbers and obvious non-content artifacts

This is a potential foundation for future differentiation around intelligent document-to-audio conversion.

## What We Are NOT Building Yet

The following ideas may be valuable later, but they are explicitly out of scope for the first prototype:

- A proprietary text-to-speech model
- A proprietary voice-cloning system
- A large voice library
- An audiobook marketplace
- Podcast generation
- A general-purpose AI chatbot
- Browser extensions
- Separate native Swift-only iOS client
- Separate native Kotlin-only Android client
- Native Windows application
- Native macOS application
- Collaboration features
- Enterprise dashboards
- Dozens of integrations
- Large-scale account-management infrastructure
- Complex billing systems before payment testing requires them

These ideas should only move into active development after user evidence supports them.

### Post-prototype roadmap note

A Chrome/Edge browser extension is intentionally deferred until the web prototype is complete and validated. The extension concept is to let a listener send the current public webpage or selected webpage text into Votic without manually creating a document. Before extension development begins, Votic should first test a simpler public-webpage-link importer and define clear browser-permission and privacy boundaries.

## Why Use the Founder's Voice First?

Using one consented founder voice can give the early product a recognizable identity while avoiding the cost and complexity of building a large voice catalog.

For the first prototype, an existing TTS or voice-cloning provider can be used. Building proprietary voice-cloning technology is a possible future research direction, not an MVP requirement.

## Validation Before Full Development

This project follows a validation-first approach.

Before investing heavily in implementation, the project should identify approximately 5–10 potential testers who already use or could benefit from text-to-speech.

Discovery should focus on understanding:

- What they currently use for text-to-speech
- What types of content they listen to
- How frequently they use TTS
- What frustrates them most
- What regularly fails or slows them down
- Which features they actually rely on
- Whether document structure or parsing causes problems
- Whether they lose their place during long listening sessions
- Whether they use TTS for comprehension, convenience, accessibility, or another reason
- What would cause them to switch from their current solution
- What they currently pay, if anything

## Evidence We Care About

Weak evidence:

- "That's a cool idea."
- "I would probably use that."
- Feature brainstorming without real usage

Stronger evidence:

- A tester provides real documents to try
- A tester repeatedly uses the prototype
- A tester chooses it over an existing workflow
- A tester asks to keep access
- A tester refers another user
- A tester pays for continued use

The prototype should evolve based on those behaviors rather than assumptions.

## Current Opportunity Hypotheses

Several potential directions are being investigated. None are considered validated yet.

### 1. Reliable Reader

A simple reader focused on dependable playback, clean document extraction, accessible controls, position tracking, and minimal friction.

### 2. Intelligent Document Reader

A reader that understands document structure instead of blindly sending extracted text to a speech engine.

Possible future capabilities could include better handling of:

- Tables
- Footnotes
- Citations
- Figures
- Reading order
- Complex layouts
- Sections that should be summarized or explained differently when heard aloud

### 3. Learning / Comprehension Reader

A listening mode designed around retaining and understanding information rather than simply reading every word aloud.

This hypothesis requires additional validation before it becomes part of the product.

## Product Principle

The long-term opportunity is not necessarily:

> **Text → Speech**

It may instead be:

> **Document → Understanding → Accessible Speech**

However, the first version should earn the right to become that ambitious.

## Development Rule

**Do not code around customer validation.**

Before every major feature, ask:

1. What user problem does this solve?
2. What evidence shows that problem matters?
3. What is the simplest version that can test the assumption?
4. How will we know whether it worked?

If those questions cannot be answered, the feature should probably wait.

## Project Stage

**Current phase:** Problem discovery / validation planning

Immediate next steps:

1. Continue competitor and user-complaint research.
2. Identify 5–10 potential prototype testers.
3. Conduct short problem-discovery conversations or written interviews.
4. Rank the recurring problems discovered.
5. Select one primary problem for v0.
6. Define the smallest prototype that can test that problem.
7. Build and release that prototype to testers.
8. Measure actual usage and willingness to continue or pay.

## Long-Term Vision

If the core reading experience proves valuable and attracts paying users, possible later expansions include additional voices, proprietary voice technology, intelligent document processing, audiobook tools, podcast creation, conversational AI, browser extensions, additional platform clients, collaboration, enterprise capabilities, and integrations.

Those are future possibilities—not commitments.

---

This repository intentionally begins with the product problem and validation plan before implementation code.
