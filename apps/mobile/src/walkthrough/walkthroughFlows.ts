/**
 * Everything the contextual walkthrough says, and which real control each step points at.
 * Sections teach an area the first time someone reaches it; tips explain one feature the first time it's used.
 */
export type SectionId = "home" | "documents" | "notes" | "reader";
export type TipId =
  | "home.documentOptions"
  | "documents.collections"
  | "notes.pinned"
  | "notes.askSelected"
  | "reader.saved"
  | "reader.ask";
export type FlowId = SectionId | TipId;

/** Where the overlay is drawn. The Reader is its own screen above the tabs, so it hosts its own overlay. */
export type WalkthroughHost = "tabs" | "reader";

/** Ids of the real controls a step can point at. Screens attach them with `useWalkthroughTarget`. */
export type TargetId =
  | "tab.documents"
  | "tab.notes"
  | "home.continue"
  | "home.recent"
  | "home.documentOptions"
  | "documents.upload"
  | "documents.search"
  | "documents.newCollection"
  | "documents.folderButton"
  | "documents.filters"
  | "notes.list"
  | "notes.empty"
  | "notes.search"
  | "notes.kinds"
  | "notes.select"
  | "reader.document"
  | "reader.progress"
  | "reader.ask"
  | "reader.play"
  | "reader.more"
  | "reader.tools"
  | "reader.close"
  | "reader.bookmark"
  | "reader.askComposer";

/** Facts about the screen when a flow starts, so steps can match what's actually on it. */
export type FlowContext = { hasDocuments?: boolean; hasNotes?: boolean; hasContinue?: boolean };

export type WalkthroughStep = {
  /** No target: the card sits near the bottom of the screen without a spotlight. */
  target?: TargetId;
  title: string | ((context: FlowContext) => string);
  message: string | ((context: FlowContext) => string);
  /** The highlighted control can be used for real; using it moves the walkthrough on. */
  interactive?: boolean;
  /** Using the highlighted control finishes the whole flow (it leads somewhere else, like another tab). */
  completesOnPress?: boolean;
  /** Only shown when this returns true. Steps whose control isn't on screen are skipped too. */
  when?: (context: FlowContext) => boolean;
};

export type WalkthroughFlow = {
  id: FlowId;
  kind: "section" | "tip";
  host: WalkthroughHost;
  steps: WalkthroughStep[];
};

export const SECTIONS: SectionId[] = ["home", "documents", "notes", "reader"];
export const SECTION_LABELS: Record<SectionId, string> = {
  home: "Home",
  documents: "Documents",
  notes: "Notes",
  reader: "Reader",
};

export const FLOWS: Record<FlowId, WalkthroughFlow> = {
  home: {
    id: "home",
    kind: "section",
    host: "tabs",
    steps: [
      {
        target: "home.continue",
        when: (c) => Boolean(c.hasContinue),
        title: "Welcome to Home",
        message: "Pick up right where you stopped. Tap here anytime to continue reading.",
      },
      {
        target: "home.recent",
        when: (c) => !c.hasContinue,
        title: "Welcome to Home",
        message:
          "Home is your starting point. Documents you've opened recently appear here, so you can jump back in.",
      },
      {
        target: "tab.documents",
        interactive: true,
        completesOnPress: true,
        title: "Your documents",
        message: (c) =>
          c.hasDocuments
            ? "Upload and organize everything you read in Documents."
            : "Upload and organize what you read in Documents. Tap it to add your first document.",
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
        target: "documents.upload",
        interactive: true,
        completesOnPress: true,
        title: (c) => (c.hasDocuments ? "Add documents" : "Add your first document"),
        message: (c) =>
          c.hasDocuments
            ? "Tap Upload anytime to bring in another PDF, Word, PowerPoint, EPUB, text, or Markdown file."
            : "Tap Upload to bring in a PDF, Word, PowerPoint, EPUB, text, or Markdown file. Votic opens it in the Reader.",
      },
      {
        target: "documents.search",
        title: "Find documents",
        message: "Search finds any document by its title.",
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
        title: "Notes stay with their source",
        message:
          "Each note is grouped under the document it came from. Open a note to read it or jump back to that spot in the document.",
      },
      {
        target: "notes.empty",
        when: (c) => !c.hasNotes,
        title: "Notes start in the Reader",
        message:
          "While reading, tap the bookmark to save a passage and add a note if you like. It appears here, grouped by document.",
      },
      {
        target: "notes.search",
        title: "Find a note",
        message:
          "Search by text, title, or tag. The filter button narrows to pinned notes, note types, or dates.",
      },
      {
        target: "notes.kinds",
        title: "Notes and saved passages",
        message: "Saved passages are what you bookmark; notes are what you write. Switch between them here.",
      },
    ],
  },
  reader: {
    id: "reader",
    kind: "section",
    host: "reader",
    steps: [
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
        target: "reader.ask",
        title: "Ask Votic",
        message:
          "Ask about what you're reading. Answers appear in a small panel, so your document stays in view.",
      },
      {
        target: "reader.play",
        title: "Listen",
        message:
          "Tap Play and Votic reads aloud from where you are, highlighting as it goes. Tap again to pause.",
      },
      {
        target: "reader.more",
        interactive: true,
        title: "More controls",
        message: "Tap More to skip between passages, change the speed, and adjust how the Reader looks.",
      },
      {
        target: "reader.tools",
        title: "Make it yours",
        message:
          "Text and Color change size, font, spacing, and light or dark theme. Listen sets the voice and speed. More sets word or sentence highlighting.",
      },
      {
        target: "reader.close",
        title: "Done reading?",
        message: "Tap here to close the document. Votic keeps your place.",
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
        message: "Tap ••• to open a document, move it to a collection, or delete it.",
      },
    ],
  },
  "documents.collections": {
    id: "documents.collections",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "documents.newCollection",
        title: "Organize with collections",
        message: "Collections work like folders. Tap New collection to create one.",
      },
      {
        target: "documents.folderButton",
        title: "Move a document",
        message: "Tap the folder icon on any document to put it in a collection.",
      },
      {
        target: "documents.filters",
        title: "Browse by collection",
        message: "Switch between All, Unfiled, and each of your collections here.",
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
  "notes.askSelected": {
    id: "notes.askSelected",
    kind: "tip",
    host: "tabs",
    steps: [
      {
        target: "notes.select",
        title: "Ask about your notes",
        message: "Choose notes, then tap Ask Votic to ask questions about just those notes.",
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
          "Type a question like “What's the main point here?” Close the panel anytime to keep reading.",
      },
    ],
  },
};

export function copyFor(step: WalkthroughStep, context: FlowContext) {
  const read = (value: WalkthroughStep["title"]) => (typeof value === "function" ? value(context) : value);
  return { title: read(step.title), message: read(step.message) };
}

/** The steps that apply to this screen right now. */
export function applicableSteps(flow: WalkthroughFlow, context: FlowContext) {
  return flow.steps.filter((step) => !step.when || step.when(context));
}
