import { personFootprint, type Point, type Layout } from "../layout";

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Puts the wedding date in the gap, or just beyond the two cards when the gap is too narrow. */
export function weddingAnchor(
  originA: Point,
  originB: Point,
  joint: Point,
  children: Point[],
  endA: Point,
  endB: Point,
  mode: Layout,
): Point {
  let dx = 0;
  let dy = 1;
  if (children.length) {
    const cx =
      children.reduce((sum, point) => sum + point.x, 0) / children.length;
    const cy =
      children.reduce((sum, point) => sum + point.y, 0) / children.length;
    dx = cx - joint.x;
    dy = cy - joint.y;
  } else if (Math.abs(endB.y - endA.y) > Math.abs(endB.x - endA.x)) {
    dx = 1;
    dy = 0;
  }
  const len = Math.hypot(dx, dy) || 1;
  const stepX = (dx / len) * 4;
  const stepY = (dy / len) * 4;
  const boxes = [
    personFootprint(originA, mode),
    personFootprint(originB, mode),
  ];
  let point = { ...joint };
  for (let i = 0; i < 80; i++) {
    const label = { x: point.x - 40, y: point.y - 10, w: 80, h: 20 };
    if (!boxes.some((box) => overlaps(label, box))) return point;
    point = { x: point.x + stepX, y: point.y + stepY };
  }
  return point;
}
