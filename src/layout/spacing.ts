import { type Layout, type Point, type Blocker } from "./types";
import { personFootprint } from "./geometry";
import { type Family } from "../domain";

/**
 * How far two anchors must stay apart. There is no maximum.
 * Partners, singles and a single beside a couple use the person gap.
 * People in different couples use the wider pair gap, so the facing
 * ribbons keep a clear margin instead of touching.
 */
export function anchorSeparation(mode: Layout, kind: "person" | "pair"): Point {
  const box = personFootprint({ x: 0, y: 0 }, mode);
  if (mode === "tapestry")
    return {
      x: box.w + (kind === "pair" ? 254 : 90),
      y: box.h + 36,
    };
  if (mode === "horizontal")
    return {
      x: box.w + 36,
      y: box.h + (kind === "pair" ? 120 : 36),
    };
  return {
    x: box.w + (kind === "pair" ? 165 : 44),
    y: box.h + 44,
  };
}

/** Person minimum. Partners may sit this close and no closer. */
export function cardSeparation(mode: Layout): Point {
  return anchorSeparation(mode, "person");
}

/** Partners share the person gap. Two different couples use the pair gap. */
export function gapKind(
  family: Family,
  a: string,
  b: string,
): "person" | "pair" {
  const partners = family.unions.some(
    (union) =>
      (union.a === a && union.b === b) || (union.a === b && union.b === a),
  );
  if (partners) return "person";
  const paired = (id: string) =>
    family.unions.some((union) => union.a === id || union.b === id);
  return paired(a) && paired(b) ? "pair" : "person";
}

export function blockersAround(
  family: Family,
  positions: Record<string, Point>,
  mover: string,
  mode: Layout,
  skip: string[] = [],
): Blocker[] {
  const hidden = new Set([mover, ...skip]);
  return Object.entries(positions)
    .filter(([id]) => !hidden.has(id))
    .map(([id, at]) => ({
      at,
      separation: anchorSeparation(mode, gapKind(family, mover, id)),
    }));
}

function asBlockers(occupied: Array<Point | Blocker>, mode: Layout): Blocker[] {
  return occupied.map((item) =>
    "separation" in item
      ? item
      : { at: item, separation: anchorSeparation(mode, "person") },
  );
}

function blockedBy(point: Point, blockers: Blocker[]) {
  return blockers.some(
    (blocker) =>
      Math.abs(point.x - blocker.at.x) < blocker.separation.x &&
      Math.abs(point.y - blocker.at.y) < blocker.separation.y,
  );
}

/** Stay on the row unless leaving it is clearly nearer than the pair gap. */
function rowBias(mode: Layout) {
  const pair = anchorSeparation(mode, "pair");
  const along = mode === "horizontal" ? pair.y : pair.x;
  const cross = mode === "horizontal" ? pair.x : pair.y;
  return along - cross + 48;
}

function closestAccepted(
  target: Point,
  accepts: (origin: Point) => boolean,
  exits: Point[],
  mode: Layout,
): Point {
  if (accepts(target)) return { ...target };
  const along = mode === "horizontal" ? "y" : "x";
  const cross = along === "x" ? "y" : "x";
  const bias = rowBias(mode);
  const candidates: Point[] = [];
  let lower: Point | undefined;
  let upper: Point | undefined;
  for (let delta = 1; delta <= 6000 && (!lower || !upper); delta++) {
    if (!lower) {
      const point = { ...target, [along]: target[along] - delta };
      if (accepts(point)) lower = point;
    }
    if (!upper) {
      const point = { ...target, [along]: target[along] + delta };
      if (accepts(point)) upper = point;
    }
  }
  if (lower) candidates.push(lower);
  if (upper) candidates.push(upper);
  for (const exit of exits) if (accepts(exit)) candidates.push(exit);
  if (!candidates.length) {
    const step = 8;
    for (let radius = 1; radius < 80 && !candidates.length; radius++)
      for (let x = -radius; x <= radius; x++)
        for (let y = -radius; y <= radius; y++)
          if (Math.max(Math.abs(x), Math.abs(y)) === radius) {
            const point = { x: target.x + x * step, y: target.y + y * step };
            if (accepts(point)) candidates.push(point);
          }
  }
  const score = (point: Point) =>
    Math.hypot(point.x - target.x, point.y - target.y) +
    (point[cross] === target[cross] ? 0 : bias);
  candidates.sort((a, b) => score(a) - score(b) || a.x - b.x || a.y - b.y);
  return candidates[0] ? { ...candidates[0] } : { ...target };
}

function separationExits(member: Point, blockers: Blocker[]): Point[] {
  const exits: Point[] = [];
  for (const blocker of blockers) {
    const sep = blocker.separation;
    const dx = member.x - blocker.at.x;
    const dy = member.y - blocker.at.y;
    if (Math.abs(dx) >= sep.x || Math.abs(dy) >= sep.y) continue;
    const signX = Math.sign(dx || 1);
    const signY = Math.sign(dy || 1);
    exits.push(
      { x: blocker.at.x + signX * sep.x, y: member.y },
      { x: blocker.at.x - signX * sep.x, y: member.y },
      { x: member.x, y: blocker.at.y + signY * sep.y },
      { x: member.x, y: blocker.at.y - signY * sep.y },
      { x: blocker.at.x + sep.x, y: blocker.at.y + sep.y },
      { x: blocker.at.x + sep.x, y: blocker.at.y - sep.y },
      { x: blocker.at.x - sep.x, y: blocker.at.y + sep.y },
      { x: blocker.at.x - sep.x, y: blocker.at.y - sep.y },
    );
  }
  return exits;
}

export function positionsOverlap(
  a: Point,
  b: Point,
  mode: Layout,
  kind: "person" | "pair" = "person",
): boolean {
  const sep = anchorSeparation(mode, kind);
  return Math.abs(a.x - b.x) < sep.x && Math.abs(a.y - b.y) < sep.y;
}

function clearOf(point: Point, occupied: Point[], mode: Layout) {
  return !occupied.some((other) => positionsOverlap(point, other, mode));
}

export function freePosition(
  target: Point,
  occupied: Array<Point | Blocker>,
  mode: Layout,
): Point {
  const blockers = asBlockers(occupied, mode);
  return closestAccepted(
    target,
    (point) => !blockedBy(point, blockers),
    separationExits(target, blockers),
    mode,
  );
}

export function partnerPosition(
  anchor: Point,
  occupied: Point[],
  mode: Layout,
): Point {
  const sep = cardSeparation(mode);
  for (let distance = 1; ; distance++) {
    for (const side of [1, -1]) {
      const candidate =
        mode === "horizontal"
          ? { x: anchor.x, y: anchor.y + side * sep.y * distance }
          : { x: anchor.x + side * sep.x * distance, y: anchor.y };
      if (clearOf(candidate, occupied, mode)) return candidate;
    }
  }
}

export function freePair(
  a: Point,
  b: Point,
  occupied: Array<Point | Blocker>,
  mode: Layout,
  occupiedB?: Array<Point | Blocker>,
): { a: Point; b: Point } {
  const delta = { x: b.x - a.x, y: b.y - a.y };
  const blockersA = asBlockers(occupied, mode);
  const blockersB = asBlockers(occupiedB ?? occupied, mode);
  const at = (origin: Point) => ({
    a: origin,
    b: { x: origin.x + delta.x, y: origin.y + delta.y },
  });
  const accepts = (origin: Point) => {
    const placed = at(origin);
    return !blockedBy(placed.a, blockersA) && !blockedBy(placed.b, blockersB);
  };
  const exits = [
    ...separationExits(a, blockersA),
    ...separationExits(b, blockersB).map((point) => ({
      x: point.x - delta.x,
      y: point.y - delta.y,
    })),
  ];
  return at(closestAccepted(a, accepts, exits, mode));
}
