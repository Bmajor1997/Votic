import { describe, expect, it } from "vitest";
import { card_placement, dim_regions, scroll_needed, spotlight_rect } from "./placement";
import { applicable_steps, copy_for, FLOWS, FlowId } from "./walkthroughFlows";
import { migrated_flows, parse_walkthrough_state } from "./walkthroughState";

const screen = { width: 390, height: 844 };

describe("spotlight placement", () => {
  it("pads the control and keeps the spotlight on screen", () => {
    expect(spotlight_rect({ x: 2, y: 100, width: 80, height: 40 }, screen)).toEqual({
      x: 0,
      y: 94,
      width: 88,
      height: 52,
    });
  });
  it("caps very tall areas so the card still fits", () => {
    expect(spotlight_rect({ x: 0, y: 200, width: 390, height: 2000 }, screen).height).toBeCloseTo(844 * 0.45);
  });
  it("puts the card on the side with more room and aims the pointer at the control", () => {
    const top = card_placement({ x: 300, y: 50, width: 80, height: 40 }, screen);
    expect(top).toMatchObject({ side: "below", top: 102, pointerX: 340 });
    const bottom = card_placement({ x: 0, y: 760, width: 98, height: 64 }, screen);
    expect(bottom).toMatchObject({ side: "above", bottom: 96, pointerX: 49 });
  });
  it("dims everything except the spotlight", () => {
    const regions = dim_regions({ x: 100, y: 100, width: 50, height: 50 }, screen);
    const dimmed = regions.reduce((sum, region) => sum + region.width * region.height, 0);
    expect(dimmed).toBe(screen.width * screen.height - 50 * 50);
  });
});

describe("walkthrough steps", () => {
  it("only shows steps that match the screen", () => {
    const targets = (context: Parameters<typeof applicable_steps>[1]) =>
      applicable_steps(FLOWS.home, context).map((step) => step.target);
    // A brand-new library: Home's Getting Started card (or the empty Continue card), this week, then the tabs.
    expect(targets({ hasStart: true })).toEqual(["home.start", "home.week", "tab.documents", "tab.notes"]);
    // Something to pick up: Continue, this week, the Recent shelf, and notes.
    expect(targets({ hasContinue: true, hasDocuments: true, hasRecent: true, hasNotes: true })).toEqual([
      "home.continue",
      "home.week",
      "home.recent",
      "home.notes",
      "tab.documents",
      "tab.notes",
    ]);
    // Everything finished and the checklist hidden: Recent leads.
    expect(targets({ hasDocuments: true, hasRecent: true })).toEqual([
      "home.week",
      "home.recent",
      "tab.documents",
      "tab.notes",
    ]);
    expect(applicable_steps(FLOWS.notes, { hasNotes: false }).map((step) => step.target)).toEqual([
      "notes.empty",
    ]);
    // Quick Note shows once the library has something in it, notes or not.
    expect(
      applicable_steps(FLOWS.notes, { hasNotes: false, canQuickNote: true }).map((step) => step.target),
    ).toEqual(["notes.empty", "notes.quickNote"]);
    expect(
      applicable_steps(FLOWS.notes, { hasNotes: true, canQuickNote: true }).map((step) => step.target),
    ).toEqual(["notes.list", "notes.quickNote", "notes.search"]);
    expect(applicable_steps(FLOWS.documents, {}).map((step) => step.target)).toEqual(["documents.upload"]);
    expect(applicable_steps(FLOWS.documents, { hasDocuments: true }).map((step) => step.target)).toEqual([
      "documents.document",
      "documents.upload",
      "documents.newCollection",
      "documents.search",
    ]);
  });
  it("words the upload step for first-time and returning use", () => {
    const step = FLOWS.documents.steps.find((item) => item.target === "documents.upload")!;
    expect(copy_for(step, { hasDocuments: false }).title).toBe("Add your first document");
    expect(copy_for(step, { hasDocuments: true }).title).toBe("Add documents");
  });
  it("teaches the Reader top to bottom: header, document, then the dock (Ask Votic, More)", () => {
    expect(FLOWS.reader.steps.map((step) => step.target)).toEqual([
      "reader.mode",
      "reader.document",
      "reader.progress",
      "reader.find",
      "reader.voice",
      "reader.play",
      "reader.bookmark",
      "reader.ask",
      "reader.more",
      "reader.tools",
      "reader.close",
    ]);
    // Voice, sleep timer, and Play exist only while listening.
    const reading = applicable_steps(FLOWS.reader, { listening: false }).map((step) => step.target);
    expect(reading).not.toContain("reader.voice");
    expect(reading).not.toContain("reader.play");
  });
  it("tells the two Reader 'More' controls apart", () => {
    const more = FLOWS.reader.steps.findIndex((step) => step.target === "reader.more");
    const listening = FLOWS.reader.steps
      .slice(more, more + 2)
      .map((step) => copy_for(step, { listening: true }).message);
    expect(listening[0]).toBe(
      "Tap More to skip between passages, change the speed, and adjust how the Reader looks.",
    );
    // The second control is described by its icon and purpose, never just as "More".
    expect(listening[1]).not.toMatch(/\bMore\b/);
    expect(listening[1]).toMatch(/••• button .* word or sentence highlighting/);
    expect(listening[1]).toMatch(/Reading focus/);
    // Read mode has no audio controls, so its More opens the reading tools.
    const reading = FLOWS.reader.steps
      .slice(more, more + 2)
      .map((step) => copy_for(step, { listening: false }).message);
    expect(reading[0]).toBe("Tap More for reading tools: text, color, and bookmarks.");
    expect(reading[1]).not.toMatch(/•••/);
  });
  it("keeps every message short", () => {
    for (const flow of Object.values(FLOWS))
      for (const step of flow.steps) {
        for (const context of [{}, { listening: true, hasDocuments: true, hasNotes: true }]) {
          const { title, message } = copy_for(step, context);
          expect(title.length).toBeLessThanOrEqual(30);
          expect(message.length).toBeLessThanOrEqual(160);
        }
      }
  });
});

describe("controls outside the visible screen", () => {
  const height = 900;
  it("leaves anything fully on screen alone, the tab bar included", () => {
    expect(scroll_needed({ x: 0, y: 300, width: 100, height: 44 }, height, "tabs")).toBe(0);
    expect(scroll_needed({ x: 0, y: 830, width: 98, height: 64 }, height, "tabs")).toBe(0);
    // A long list only needs its top in view.
    expect(scroll_needed({ x: 0, y: 200, width: 350, height: 2000 }, height, "tabs")).toBe(0);
  });
  it("scrolls a control below the fold (or behind the tab bar) up to about a third of the way down", () => {
    expect(scroll_needed({ x: 0, y: 1500, width: 350, height: 200 }, height, "tabs")).toBe(1500 - 300);
    // Its top peeks out above the tab bar, but the rest is hidden behind it and below the screen.
    expect(scroll_needed({ x: 0, y: 780, width: 350, height: 240 }, height, "tabs")).toBe(780 - 300);
  });
  it("scrolls back up to a control above the screen", () => {
    expect(scroll_needed({ x: 0, y: -400, width: 350, height: 80 }, height, "tabs")).toBe(-400 - 300);
  });
});

describe("saved walkthrough progress", () => {
  it("keeps each flow separate and drops anything unknown", () => {
    expect(
      parse_walkthrough_state(
        JSON.stringify({
          flows: {
            home: { status: "skipped", at: 5 },
            nonsense: { status: "completed" },
            notes: { status: "maybe" },
          },
        }),
      ),
    ).toEqual({ version: 1, flows: { home: { status: "skipped", at: 5 } } });
    expect(parse_walkthrough_state("{")).toBeNull();
  });
});

describe("existing Votic users", () => {
  const learned = (input: Parameters<typeof migrated_flows>[0]) => new Set<FlowId>(migrated_flows(input));
  it("new installs learn everything as they go", () => {
    expect(learned({ existingDevice: false, documents: [{ progress: 1 }], collections: ["Work"] }).size).toBe(
      0,
    );
  });
  it("skip only what they've clearly used", () => {
    const reader = learned({ existingDevice: true, documents: [{ progress: 0.4 }], collections: [] });
    expect([...reader].sort()).toEqual([
      "allSet",
      "documents",
      "home",
      "home.documentOptions",
      "intro",
      "reader",
    ]);
    const notes = learned({
      existingDevice: true,
      documents: [{ collection: "Work", savedPassages: [{ pinned: true }] }],
      collections: [],
    });
    expect(notes.has("notes")).toBe(true);
    expect(notes.has("notes.pinned")).toBe(true);
    expect(notes.has("documents.collections")).toBe(true);
    expect(notes.has("reader")).toBe(false);
  });
  it("still teach Documents, Notes, and the Reader to an existing install with no documents", () => {
    expect([...learned({ existingDevice: true, documents: [], collections: [] })]).toEqual([
      "intro",
      "allSet",
      "home",
    ]);
  });
});
