import { type Layout, type Point, type Rect } from "./types";

export function slotSize(mode: Layout) {
  // Tapestry names sit on a ribbon just below the portrait, so the placeholder
  // stays as tall as the portrait above that ribbon.
  return mode === "tapestry" ? { w: 60, h: 54 } : { w: 46, h: 54 };
}

/** Visible card, or the tapestry portrait plus its name ribbon. */
export function personFootprint(point: Point, mode: Layout): Rect {
  if (mode === "tapestry")
    return { x: point.x - 17, y: point.y, w: 214, h: 126 };
  if (mode === "chart") return { x: point.x, y: point.y, w: 168, h: 108 };
  return { x: point.x, y: point.y, w: 180, h: 120 };
}

/** The face the partner placeholder should sit against. */
export function personFace(point: Point, mode: Layout): Rect {
  if (mode === "tapestry") return { x: point.x + 60, y: point.y, w: 60, h: 70 };
  return personFootprint(point, mode);
}

/** Portrait-sized partner placeholder, flush with the person. */
export function partnerSlotBox(origin: Point, mode: Layout): Rect {
  return { ...origin, ...slotSize(mode) };
}

export function expandRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  };
}

export function inflate(rect: Rect, pad = 10): Rect {
  return expandRect(rect, pad);
}

export function rectsOverlap(a: Rect, b: Rect, gap = 8) {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

export function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function segmentHitsRect(a: Point, b: Point, rect: Rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const edges: [Point, Point][] = [
    [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
    ],
    [
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ],
    [
      { x: rect.x, y: rect.y + rect.h },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ],
    [
      { x: rect.x, y: rect.y },
      { x: rect.x, y: rect.y + rect.h },
    ],
  ];
  return edges.some(([c, d]) => segmentsCross(a, b, c, d));
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const orient = (p: Point, q: Point, r: Point) =>
    (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const o1 = orient(a, b, c),
    o2 = orient(a, b, d),
    o3 = orient(c, d, a),
    o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function polylineHitsRect(points: Point[], rect: Rect) {
  for (let index = 1; index < points.length; index++)
    if (segmentHitsRect(points[index - 1], points[index], rect)) return true;
  return false;
}

export function polylinesCross(a: Point[], b: Point[]) {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++)
      if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}
