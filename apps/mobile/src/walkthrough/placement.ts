export type Rect = { x: number; y: number; width: number; height: number };

const SPOTLIGHT_PADDING = 6;
const GAP = 12;
/** Large areas (a whole list, the document text) are highlighted from their top, leaving room for the card. */
const MAX_SPOTLIGHT_SHARE = 0.45;

/** The highlighted area: the control plus a little breathing room, kept inside the screen. */
export function spotlight_rect(target: Rect, screen: { width: number; height: number }): Rect {
  const x = Math.max(0, target.x - SPOTLIGHT_PADDING);
  const y = Math.max(0, target.y - SPOTLIGHT_PADDING);
  const right = Math.min(screen.width, target.x + target.width + SPOTLIGHT_PADDING);
  const bottom = Math.min(
    screen.height,
    target.y + target.height + SPOTLIGHT_PADDING,
    y + screen.height * MAX_SPOTLIGHT_SHARE,
  );
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/**
 * Puts the coaching card on whichever side of the control has more room, with a small pointer aimed at
 * the control's center. The card's height isn't needed: "above" cards are anchored by their bottom edge.
 */
export function card_placement(spotlight: Rect, screen: { width: number; height: number }, gutter = 16) {
  const spaceAbove = spotlight.y;
  const spaceBelow = screen.height - (spotlight.y + spotlight.height);
  const side: "above" | "below" = spaceBelow >= spaceAbove ? "below" : "above";
  const pointerX = Math.min(
    screen.width - gutter - 20,
    Math.max(gutter + 20, spotlight.x + spotlight.width / 2),
  );
  return side === "below"
    ? { side, top: spotlight.y + spotlight.height + GAP, pointerX }
    : { side, bottom: screen.height - spotlight.y + GAP, pointerX };
}

/** The four dimmed rectangles around the spotlight; the spotlight itself stays clear. */
export function dim_regions(spotlight: Rect, screen: { width: number; height: number }): Rect[] {
  const right = spotlight.x + spotlight.width;
  const bottom = spotlight.y + spotlight.height;
  return [
    { x: 0, y: 0, width: screen.width, height: spotlight.y },
    { x: 0, y: bottom, width: screen.width, height: screen.height - bottom },
    { x: 0, y: spotlight.y, width: spotlight.x, height: spotlight.height },
    { x: right, y: spotlight.y, width: screen.width - right, height: spotlight.height },
  ].filter((region) => region.width > 0 && region.height > 0);
}

/** Room kept clear at the bottom for the tab bar (Votic's tabs) or the Reader's dock. */
const BOTTOM_RESERVE = { tabs: 96, reader: 0 } as const;
/**
 * How far to scroll so the control's top part is in view with room for the card, or 0 when it already is.
 * Large areas (a list, the document) only need their top in view.
 */
export function scroll_needed(target: Rect, screenHeight: number, host: "tabs" | "reader") {
  // Entirely on screen (the tab bar itself included) needs no scrolling.
  if (target.y >= 0 && target.y + target.height <= screenHeight) return 0;
  const visibleBottom = screenHeight - BOTTOM_RESERVE[host];
  const shown = Math.min(target.height, 120);
  if (target.y >= 0 && target.y + shown <= visibleBottom) return 0;
  // Leave the control about a third of the way down, so the card fits above or below it.
  return Math.round(target.y - screenHeight / 3);
}
