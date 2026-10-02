import { describe, expect, it } from "vitest";
import { cardPlacement, dimRegions, spotlightRect } from "./placement";
import { applicableSteps, copyFor, FLOWS, FlowId } from "./walkthroughFlows";
import { migratedFlows, parseWalkthroughState } from "./walkthroughState";

const screen = { width: 390, height: 844 };

describe("spotlight placement", () => {
  it("pads the control and keeps the spotlight on screen", () => {
    expect(spotlightRect({ x: 2, y: 100, width: 80, height: 40 }, screen)).toEqual({
      x: 0,
      y: 94,
      width: 88,
      height: 52,
    });
  });
  it("caps very tall areas so the card still fits", () => {
    expect(spotlightRect({ x: 0, y: 200, width: 390, height: 2000 }, screen).height).toBeCloseTo(844 * 0.45);
  });
  it("puts the card on the side with more room and aims the pointer at the control", () => {
    const top = cardPlacement({ x: 300, y: 50, width: 80, height: 40 }, screen);
    expect(top).toMatchObject({ side: "below", top: 102, pointerX: 340 });
    const bottom = cardPlacement({ x: 0, y: 760, width: 98, height: 64 }, screen);
    expect(bottom).toMatchObject({ side: "above", bottom: 96, pointerX: 49 });
  });
  it("dims everything except the spotlight", () => {
    const regions = dimRegions({ x: 100, y: 100, width: 50, height: 50 }, screen);
    const dimmed = regions.reduce((sum, region) => sum + region.width * region.height, 0);
    expect(dimmed).toBe(screen.width * screen.height - 50 * 50);
  });
});

describe("walkthrough steps", () => {
  it("only shows steps that match the screen", () => {
    const targets = (context: Parameters<typeof applicableSteps>[1]) =>
      applicableSteps(FLOWS.home, context).map((step) => step.target);
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
    expect(applicableSteps(FLOWS.notes, { hasNotes: false }).map((step) => step.target)).toEqual([
      "notes.empty",
    ]);
    expect(applicableSteps(FLOWS.documents, {}).map((step) => step.target)).toEqual(["documents.upload"]);
  });
  it("words the upload step for first-time and returning use", () => {
    const step = FLOWS.documents.steps.find((item) => item.target === "documents.upload")!;
    expect(copyFor(step, { hasDocuments: false }).title).toBe("Add your first document");
    expect(copyFor(step, { hasDocuments: true }).title).toBe("Add documents");
  });
  it("teaches the Reader dock in the order it appears: Ask Votic, Play, More", () => {
    expect(FLOWS.reader.steps.map((step) => step.target)).toEqual([
      "reader.document",
      "reader.progress",
      "reader.ask",
      "reader.play",
      "reader.more",
      "reader.tools",
      "reader.close",
    ]);
  });
  it("tells the two Reader 'More' controls apart", () => {
    const listening = FLOWS.reader.steps
      .slice(4, 6)
      .map((step) => copyFor(step, { listening: true }).message);
    expect(listening[0]).toBe(
      "Tap More to skip between passages, change the speed, and adjust how the Reader looks.",
    );
    // The second control is described by its icon and purpose, never just as "More".
    expect(listening[1]).not.toMatch(/\bMore\b/);
    expect(listening[1]).toMatch(/••• button .* word or sentence highlighting/);
    // Read mode has no audio controls, so its More opens the reading tools.
    const reading = FLOWS.reader.steps.slice(4, 6).map((step) => copyFor(step, { listening: false }).message);
    expect(reading[0]).toBe("Tap More for reading tools: text, color, listening, and bookmarks.");
    expect(reading[1]).not.toMatch(/•••/);
  });
  it("keeps every message short", () => {
    for (const flow of Object.values(FLOWS))
      for (const step of flow.steps) {
        for (const context of [{}, { listening: true, hasDocuments: true, hasNotes: true }]) {
          const { title, message } = copyFor(step, context);
          expect(title.length).toBeLessThanOrEqual(30);
          expect(message.length).toBeLessThanOrEqual(160);
        }
      }
  });
});

describe("saved walkthrough progress", () => {
  it("keeps each flow separate and drops anything unknown", () => {
    expect(
      parseWalkthroughState(
        JSON.stringify({
          flows: {
            home: { status: "skipped", at: 5 },
            nonsense: { status: "completed" },
            notes: { status: "maybe" },
          },
        }),
      ),
    ).toEqual({ version: 1, flows: { home: { status: "skipped", at: 5 } } });
    expect(parseWalkthroughState("{")).toBeNull();
  });
});

describe("existing Votic users", () => {
  const learned = (input: Parameters<typeof migratedFlows>[0]) => new Set<FlowId>(migratedFlows(input));
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
