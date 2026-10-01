export type Rect = { x: number; y: number; width: number; height: number };

const SPOTLIGHT_PADDING = 6;
const GAP = 12;
/** Large areas (a whole list, the document text) are highlighted from their top, leaving room for the card. */
const MAX_SPOTLIGHT_SHARE = 0.45;

/** The highlighted area: the control plus a little breathing room, kept inside the screen. */
export function spotlightRect(target: Rect, screen: { width: number; height: number }): Rect {
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
export function cardPlacement(spotlight: Rect, screen: { width: number; height: number }, gutter = 16) {
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
export function dimRegions(spotlight: Rect, screen: { width: number; height: number }): Rect[] {
  const right = spotlight.x + spotlight.width;
  const bottom = spotlight.y + spotlight.height;
  return [
    { x: 0, y: 0, width: screen.width, height: spotlight.y },
    { x: 0, y: bottom, width: screen.width, height: screen.height - bottom },
    { x: 0, y: spotlight.y, width: spotlight.x, height: spotlight.height },
    { x: right, y: spotlight.y, width: screen.width - right, height: spotlight.height },
  ].filter((region) => region.width > 0 && region.height > 0);
}
