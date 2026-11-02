/**
 * Everything the contextual walkthrough says, and which real control each step points at.
 * Sections teach an area the first time someone reaches it; tips explain one feature the first time it's used.
 */
export type SectionId = "home" | "documents" | "notes" | "reader" | "settings";
export type TipId =
  | "home.documentOptions"
  | "documents.collections"
  | "documents.select"
  | "notes.pinned"
  | "notes.askSelected"
  | "reader.saved"
  | "reader.ask"
  | "reader.answer";
/**
 * "intro" is the one-time "Let's show you around" card before Home coaching; "allSet" is the one-time card after
 * the Reader walkthrough is completed. Each is tracked on its own, like every other flow.
 */
export type MomentId = "intro" | "allSet";
export type FlowId = SectionId | TipId | MomentId;

/** Where the overlay is drawn. The Reader is its own screen above the tabs, so it hosts its own overlay. */
export type WalkthroughHost = "tabs" | "reader";

/** Ids of the real controls a step can point at. Screens attach them with `useWalkthroughTarget`. */
export type TargetId =
  | "tab.documents"
  | "tab.notes"
  | "home.continue"
  | "home.start"
  | "home.recent"
  | "home.notes"
  | "home.week"
  | "home.documentOptions"
  | "documents.upload"
  | "documents.document"
  | "documents.search"
  | "documents.newCollection"
  | "documents.documentOptions"
  | "documents.filters"
  | "documents.select"
  | "notes.list"
  | "notes.empty"
  | "notes.search"
  | "notes.select"
  | "notes.quickNote"
  | "reader.mode"
  | "reader.find"
  | "reader.voice"
  | "reader.document"
  | "reader.progress"
  | "reader.ask"
  | "reader.play"
  | "reader.more"
  | "reader.tools"
  | "reader.close"
  | "reader.bookmark"
  | "reader.askComposer"
  | "reader.answerSource"
  | "settings.preferences";

/** Facts about the screen when a flow starts, so steps can match what's actually on it. */
export type FlowContext = {
  hasDocuments?: boolean;
  hasNotes?: boolean;
  hasContinue?: boolean;
  /** Home shows its Browse documents card because there is nothing to continue. */
  hasStart?: boolean;
  /** Home shows the Recent shelf (documents other than the one in Continue). */
  hasRecent?: boolean;
  /** The Reader was opened to listen (audio controls) rather than to read. */
  listening?: boolean;
  /** Notes shows Quick Note (once the library has something in it). */
  canQuickNote?: boolean;
};

export type WalkthroughStep = {
  /** No target: the card sits near the bottom of the screen without a spotlight. */
  target?: TargetId;
  title: string | ((context: FlowContext) => string);
  message: string | ((context: FlowContext) => string);
  /** The highlighted control can be used for real; using it moves the walkthrough on. */
  interactive?: boolean;
  /** Using the highlighted control finishes the whole flow (it leads somewhere else, like another tab). */
  completesOnPress?: boolean;
  /** Button wording, when "Next" / "Got it" and "Skip" don't fit. The secondary button skips the flow. */
  primaryLabel?: string;
  secondaryLabel?: string;
  /** Only shown when this returns true. Steps whose control isn't on screen are skipped too. */
  when?: (context: FlowContext) => boolean;
};

export type WalkthroughFlow = {
  id: FlowId;
  kind: "section" | "tip" | "moment";
  host: WalkthroughHost;
  steps: WalkthroughStep[];
};

export const SECTIONS: SectionId[] = ["home", "documents", "notes", "reader", "settings"];
export const SECTION_LABELS: Record<SectionId, string> = {
  home: "Home",
  documents: "Documents",
  notes: "Notes",
  reader: "Reader",
  settings: "Settings",
};

export const FLOWS: Record<FlowId, WalkthroughFlow> = {
  intro: {
    id: "intro",
    kind: "moment",
    host: "tabs",
    steps: [
      {
        title: "Let's show you around",
        message: "We'll show you around as you explore, so you can learn Votic as you use it.",
        primaryLabel: "Show me around",
        secondaryLabel: "I'll explore on my own",
      },
    ],
  },
  allSet: {
    id: "allSet",
    kind: "moment",
    host: "reader",
    steps: [
      {
        title: "You're all set",
        message:
          "You know the essentials. Keep exploring Votic, and we'll show you helpful tips when you need them.",
      },
    ],
  },
  home: {
    id: "home",
    kind: "section",
    host: "tabs",
    steps: [
      {
        target: "home.continue",
        when: (c) => Boolean(c.hasContinue),
        title: "Welcome to Home",
        message:
          "Pick up where you left off. Continue Listening plays from your spot, and Continue Reading opens it to read on your own.",
      },
      {
        target: "home.start",
        when: (c) => !c.hasContinue && Boolean(c.hasStart),
        title: "Welcome to Home",
        message:
          "Go to Documents to choose a read or upload a file. Continue reading and listening here afterward.",
      },
      {
        target: "home.week",
        // The weekly summary follows the Continue or Browse documents card.
        title: (c) => (c.hasContinue || c.hasStart ? "Your week" : "Welcome to Home"),
        message: (c) =>
          c.hasDocuments
            ? "Your reading and listening time this week. Tap Statistics for the full picture."
            : "Your reading and listening time will show here once you start. Statistics has the full picture.",
      },
      {
        target: "home.recent",
        when: (c) => Boolean(c.hasRecent),
        title: "Recent documents",
        message: "Documents you've opened recently are here. Swipe to see more, and tap one to jump back in.",
      },
      {
        target: "home.notes",
        when: (c) => Boolean(c.hasNotes),
        title: "From your notes",
        message: "Pinned and recent notes show up here. Tap one to go back to that spot in its document.",
      },
      {
        target: "tab.documents",
        interactive: true,
        completesOnPress: true,
        title: "Your documents",
        message: (c) =>
          c.hasDocuments
            ? "Add and organize everything you read in Documents."
            : "Add and organize what you read in Documents. Tap it to add your first document.",
      },
      {
        target: "tab.notes",
        title: "Your notes",
        message: "Passages you save while reading, and the notes you add, collect in Notes.",
      },
    ],
  },
  documents: {
    id: "documents",
    kind: "section",
    host: "tabs",
    steps: [
      {
        target: "documents.document",
        when: (c) => Boolean(c.hasDocuments),
        title: "Your library",
        message:
          "Each document shows how far you've read. Tap one to pick up where you left off, or ••• to rename, move, or delete it.",
      },
      {
        target: "documents.upload",
        interactive: true,
        completesOnPress: true,
        title: (c) => (c.hasDocuments ? "Add documents" : "Add your first document"),
        message: (c) =>
          c.hasDocuments
            ? "Tap Add anytime to bring in a file, paste a web link, or scan a printed page with your camera."
            : "Tap Add to choose a file, paste a web link, or scan a printed page with your camera. Votic opens it in the Reader.",
      },
      {
        target: "documents.newCollection",
        when: (c) => Boolean(c.hasDocuments),
        title: "Organize with collections",
        message: "The folder button makes a collection, like a folder for related reading.",
      },
      {
        target: "documents.search",
        when: (c) => Boolean(c.hasDocuments),
        title: "Find and filter",
        message:
          "Search finds any document by its title. The filter button sorts your library or shows one collection.",
      },
    ],
  },
  notes: {
    id: "notes",
    kind: "section",
    host: "tabs",
    steps: [
      {
        target: "notes.list",
        when: (c) => Boolean(c.hasNotes),
        title: "Your notebooks",
        message:
          "Each document gets its own notebook of saved passages and notes. Open one to read a note or jump back to that spot in the document.",
      },
      {
        target: "notes.empty",
        when: (c) => !c.hasNotes,
        title: "Notes start in the Reader",
        message:
          "While reading, tap the bookmark at the top to save a passage and add a note if you like. It appears here, linked to your document.",
      },
      {
        target: "notes.quickNote",
        when: (c) => Boolean(c.canQuickNote),
        title: "Quick Note",
        message: "Write down a thought that isn't tied to a document. Quick Notes keep their own notebook.",
      },
      {
        target: "notes.search",
        when: (c) => Boolean(c.hasNotes),
        title: "Find a note",
        message:
          "Search by text, title, or tag. The filter button narrows to pinned notes, note types, or dates.",
      },
    ],
  },
  reader: {
    id: "reader",
    kind: "section",
    host: "reader",
    steps: [
      {
        target: "reader.mode",
        title: "Read or Listen",
        message: "Switch anytime between reading on your own and having Votic read aloud to you.",
      },
      {
        target: "reader.document",
        title: "Your document",
        message:
          "Scroll to read at your own pace. Votic remembers where you stop, even if you close the app.",
      },
      {
        target: "reader.progress",
        title: "Your progress",
        message: "See how far you've read. Drag the bar to jump to any part of the document.",
      },
      {
        target: "reader.find",
        title: "Find",
        message: "Search for any word or phrase in this document and jump straight to it.",
      },
      {
        target: "reader.voice",
        when: (c) => Boolean(c.listening),
        title: "Voice and sleep timer",
        message:
          "Tap the voice name to choose another voice. Sleep timer, at the top of the Reader, stops playback after the time you pick.",
      },
      {
        target: "reader.play",
        when: (c) => Boolean(c.listening),
        title: "Listen",
        message:
          "Tap Play and Votic reads aloud from where you are. It highlights each sentence and makes the spoken word bigger, so you can follow along.",
      },
      {
        target: "reader.bookmark",
        title: "Save a passage",
        message:
          "The bookmark saves this passage to Notes, with a note if you like, so you can come back to it.",
      },
      {
        target: "reader.ask",
        title: "Ask Votic",
        message:
          "Type or speak a question about what you're reading. Answers show where they came from, and your document stays in view.",
      },
      {
        target: "reader.more",
        interactive: true,
        title: "More controls",
        message: (c) =>
          c.listening
            ? "Tap More to skip between passages, change the speed, and adjust how the Reader looks."
            : "Tap More for reading tools: text, color, and bookmarks.",
      },
      {
        target: "reader.tools",
        title: "Make it yours",
        message: (c) =>
          c.listening
            ? "Text and Color set size, font, spacing, and theme. Listen sets voice and speed. The ••• button at the end opens Reading focus: word or sentence highlighting."
            : "Text and Color adjust size, font, spacing, and theme, and Bookmark saves this passage to Notes.",
      },
      {
        target: "reader.close",
        title: "Done reading?",
        message: "Tap here to close the document. Votic keeps your place.",
      },
    ],
  },
  settings: {
    id: "settings",
    kind: "section",
    host: "tabs",
    steps: [
      {
        target: "settings.preferences",
        title: "Make Votic yours",
        message:
          "Change how Votic looks, reads, and sounds here: text size, colors, voices, highlighting, and contrast.",
      },
      {
        title: "Replay any walkthrough",
        message: "To see any of these walkthroughs again, open Help, then Learn Votic.",
      },
    ],
  },
  "home.documentOptions": {
    id: "home.documentOptions",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "home.documentOptions",
        title: "Document options",
        message: "Tap ••• to open, rename, move, or delete a document.",
      },
    ],
  },
  "documents.collections": {
    id: "documents.collections",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "documents.documentOptions",
        title: "Move a document",
        message: "Tap ••• on any document, then Move to collection.",
      },
      {
        target: "documents.filters",
        title: "Browse by collection",
        message: "Open Sort and filter to show just one collection.",
      },
    ],
  },
  "documents.select": {
    id: "documents.select",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "documents.select",
        title: "Select documents",
        message:
          "Choose one or more documents, or Select all, then Delete. Deleted documents stay in Recently Deleted for 30 days.",
      },
    ],
  },
  "notes.pinned": {
    id: "notes.pinned",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "notes.search",
        title: "Pinned",
        message: "Pinned notes stay easy to find. Choose Pinned in Filters to see only them.",
      },
    ],
  },
  // Keep the saved tip ID; selection now covers sharing and deletion.
  "notes.askSelected": {
    id: "notes.askSelected",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "notes.select",
        title: "Manage selected notes",
        message: "Choose notes to share or move to Recently Deleted. Cancel to return to your notebooks.",
      },
    ],
  },
  "reader.saved": {
    id: "reader.saved",
    kind: "tip",
    host: "reader",
    steps: [
      {
        target: "reader.bookmark",
        title: "Saved to Notes",
        message:
          "This passage is now in Notes, linked to this spot. Open it from Notes to come straight back here.",
      },
    ],
  },
  "reader.ask": {
    id: "reader.ask",
    kind: "tip",
    host: "reader",
    steps: [
      {
        target: "reader.askComposer",
        title: "Ask about this document",
        message:
          "Type a question, or tap the mic to ask out loud. Try “What's the main point here?” Close the panel anytime to keep reading.",
      },
    ],
  },
  "reader.answer": {
    id: "reader.answer",
    kind: "tip",
    host: "reader",
    steps: [
      {
        target: "reader.answerSource",
        title: "Where this answer came from",
        message:
          "Tap here to jump to the passage Votic used. Under the answer, the speaker reads it aloud and the bookmark saves it to Notes.",
      },
    ],
  },
};

export function copy_for(step: WalkthroughStep, context: FlowContext) {
  const read = (value: WalkthroughStep["title"]) => (typeof value === "function" ? value(context) : value);
  return { title: read(step.title), message: read(step.message) };
}

/** The steps that apply to this screen right now. */
export function applicable_steps(flow: WalkthroughFlow, context: FlowContext) {
  return flow.steps.filter((step) => !step.when || step.when(context));
}
