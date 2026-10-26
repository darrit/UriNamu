import { type Family, type Person, childrenOf, dynastyMembers } from "./domain";
export type Layout = "classic" | "horizontal" | "tapestry";
export type Point = { x: number; y: number };

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
export function gapKind(family: Family, a: string, b: string): "person" | "pair" {
  const partners = family.unions.some(
    (union) =>
      (union.a === a && union.b === b) || (union.a === b && union.b === a),
  );
  if (partners) return "person";
  const paired = (id: string) =>
    family.unions.some((union) => union.a === id || union.b === id);
  return paired(a) && paired(b) ? "pair" : "person";
}

export type Blocker = { at: Point; separation: Point };

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

function partnerPosition(
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

export type Rect = { x: number; y: number; w: number; h: number };

function slotSize(mode: Layout) {
  // Tapestry names sit on a ribbon just below the portrait, so the placeholder
  // stays as tall as the portrait above that ribbon.
  return mode === "tapestry" ? { w: 60, h: 54 } : { w: 46, h: 54 };
}

/** Visible card, or the tapestry portrait plus its name ribbon. */
export function personFootprint(point: Point, mode: Layout): Rect {
  if (mode === "tapestry") return { x: point.x - 17, y: point.y, w: 214, h: 126 };
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

function expandRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  };
}

function inflate(rect: Rect, pad = 10): Rect {
  return expandRect(rect, pad);
}

function rectsOverlap(a: Rect, b: Rect, gap = 8) {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function segmentHitsRect(a: Point, b: Point, rect: Rect) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const edges: [Point, Point][] = [
    [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }],
    [
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ],
    [
      { x: rect.x, y: rect.y + rect.h },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ],
    [{ x: rect.x, y: rect.y }, { x: rect.x, y: rect.y + rect.h }],
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

function polylineHitsRect(points: Point[], rect: Rect) {
  for (let index = 1; index < points.length; index++)
    if (segmentHitsRect(points[index - 1], points[index], rect)) return true;
  return false;
}

function polylinesCross(a: Point[], b: Point[]) {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++)
      if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) return true;
  return false;
}

function routeMid(points: Point[]): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  let total = 0;
  const spans = points.slice(1).map((point, index) => {
    const length = Math.hypot(
      point.x - points[index].x,
      point.y - points[index].y,
    );
    total += length;
    return length;
  });
  let walked = 0;
  const half = total / 2;
  for (let index = 1; index < points.length; index++) {
    const next = walked + spans[index - 1];
    if (next >= half || index === points.length - 1) {
      const remain = Math.max(spans[index - 1], 1);
      const t = (half - walked) / remain;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * t,
      };
    }
    walked = next;
  }
  return points[Math.floor(points.length / 2)];
}

function cardBox(position: Point, mode: Layout) {
  const box = personFootprint(position, mode);
  return {
    l: box.x,
    r: box.x + box.w,
    t: box.y,
    b: box.y + box.h,
    cx: box.x + box.w / 2,
    cy: box.y + box.h / 2,
  };
}

function facingPorts(from: Point, to: Point, mode: Layout) {
  const A = cardBox(from, mode),
    B = cardBox(to, mode);
  const horizontalGap = Math.max(B.l - A.r, A.l - B.r),
    verticalGap = Math.max(B.t - A.b, A.t - B.b),
    sideBySide = horizontalGap >= verticalGap;
  const port = sideBySide
    ? B.cx >= A.cx
      ? { x: A.r, y: A.cy, dx: 1, dy: 0 }
      : { x: A.l, y: A.cy, dx: -1, dy: 0 }
    : B.cy >= A.cy
      ? { x: A.cx, y: A.b, dx: 0, dy: 1 }
      : { x: A.cx, y: A.t, dx: 0, dy: -1 };
  const into = sideBySide
    ? B.cx >= A.cx
      ? { x: B.l, y: B.cy, dx: -1, dy: 0 }
      : { x: B.r, y: B.cy, dx: 1, dy: 0 }
    : B.cy >= A.cy
      ? { x: B.cx, y: B.t, dx: 0, dy: -1 }
      : { x: B.cx, y: B.b, dx: 0, dy: 1 };
  return { port, into };
}

function aroundRect(start: Point, end: Point, rect: Rect): Point[] {
  const options = [
    [
      { x: start.x, y: rect.y - 12 },
      { x: end.x, y: rect.y - 12 },
    ],
    [
      { x: start.x, y: rect.y + rect.h + 12 },
      { x: end.x, y: rect.y + rect.h + 12 },
    ],
    [
      { x: rect.x - 12, y: start.y },
      { x: rect.x - 12, y: end.y },
    ],
    [
      { x: rect.x + rect.w + 12, y: start.y },
      { x: rect.x + rect.w + 12, y: end.y },
    ],
  ];
  const scored = options.map((points) => {
    const route = [start, ...points, end];
    const length = route.slice(1).reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - route[index].x, point.y - route[index].y),
      0,
    );
    return { points, length, hits: polylineHitsRect(route, rect) };
  });
  scored.sort((a, b) => Number(a.hits) - Number(b.hits) || a.length - b.length);
  return scored[0].points;
}

function detourRoute(
  start: Point,
  end: Point,
  obstacles: Rect[],
  others: Point[][],
): Point[] {
  let route = [start, end];
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const rect of obstacles) {
      for (let index = 1; index < route.length; index++) {
        if (!segmentHitsRect(route[index - 1], route[index], rect)) continue;
        const extra = aroundRect(route[index - 1], route[index], rect);
        route.splice(index, 0, ...extra);
        changed = true;
        break;
      }
    }
    for (const other of others) {
      if (!polylinesCross(route, other)) continue;
      const mid = routeMid(route);
      const otherMid = routeMid(other);
      const dx = mid.x - otherMid.x,
        dy = mid.y - otherMid.y,
        len = Math.hypot(dx, dy) || 1;
      const bump = {
        x: mid.x + (dx / len) * 48,
        y: mid.y + (dy / len) * 48,
      };
      route = [start, bump, end];
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return route.filter(
    (point, index, list) =>
      index === 0 ||
      Math.hypot(point.x - list[index - 1].x, point.y - list[index - 1].y) > 1,
  );
}

function routeHitsObstacles(route: Point[], obstacles: Rect[]) {
  return obstacles.some((rect) => polylineHitsRect(route, rect));
}

function markerClear(point: Point, obstacles: Rect[]) {
  return !obstacles.some((rect) =>
    pointInRect(point, inflate(rect, 6)),
  );
}

function partnerSlotOrigin(person: Point, side: 1 | -1, mode: Layout): Point {
  const size = slotSize(mode);
  const gap = 10;
  if (mode === "tapestry") {
    const face = personFace(person, mode);
    return {
      x: side > 0 ? face.x + face.w + gap : face.x - gap - size.w,
      y: person.y,
    };
  }
  return {
    x: side > 0 ? person.x + 180 + gap : person.x - gap - size.w,
    y: person.y + 12,
  };
}

function slotClearance(
  positions: Record<string, Point>,
  slots: Point[],
  anchorId: string,
  side: 1 | -1,
  mode: Layout,
) {
  const origin = partnerSlotOrigin(positions[anchorId], side, mode);
  const slot = partnerSlotBox(origin, mode);
  let push = 0;
  let threshold = side > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  for (const [id, point] of Object.entries(positions)) {
    if (id === anchorId) continue;
    if (!rectsOverlap(slot, personFootprint(point, mode))) continue;
    const rect = personFootprint(point, mode);
    const amount =
      side > 0 ? slot.x + slot.w + 8 - rect.x : rect.x + rect.w + 8 - slot.x;
    if (amount > push) push = amount;
    threshold = side > 0 ? Math.min(threshold, point.x) : Math.max(threshold, point.x);
  }
  for (const existing of slots) {
    const rect = partnerSlotBox(existing, mode);
    if (!rectsOverlap(slot, rect)) continue;
    const amount =
      side > 0 ? slot.x + slot.w + 8 - rect.x : rect.x + rect.w + 8 - slot.x;
    if (amount > push) push = amount;
    threshold =
      side > 0 ? Math.min(threshold, existing.x) : Math.max(threshold, existing.x);
  }
  return { origin, push: Math.max(0, push), threshold };
}

/** Puts each free partner place directly beside its person, shifting neighbours when needed. */
function placePartnerSlots(
  positions: Record<string, Point>,
  family: Family,
  mode: Layout,
  pinned: Set<string>,
  routes: Point[][] = [],
) {
  const open = family.members
    .filter(
      (person) =>
        positions[person.id] &&
        !family.unions.some(
          (union) =>
            union.status === "active" &&
            (union.a === person.id || union.b === person.id),
        ),
    )
    .sort(
      (a, b) =>
        positions[a.id].x - positions[b.id].x ||
        positions[a.id].y - positions[b.id].y,
    );
  const slots: { id: string; x: number; y: number }[] = [];
  for (const person of open) {
    const best = ([1, -1] as const)
      .map((side) => {
        const clearance = slotClearance(positions, slots, person.id, side, mode);
        const box = partnerSlotBox(clearance.origin, mode);
        const blocked = routes.some((route) => polylineHitsRect(route, inflate(box, 4)));
        return { side, ...clearance, blocked };
      })
      .sort(
        (a, b) =>
          Number(a.blocked) - Number(b.blocked) ||
          a.push - b.push ||
          b.side - a.side,
      )[0];
    if (best.push > 0 && Number.isFinite(best.threshold)) {
      for (const id of Object.keys(positions)) {
        if (id === person.id || pinned.has(id)) continue;
        const x = positions[id].x;
        if (best.side > 0 ? x >= best.threshold - 0.1 : x <= best.threshold + 0.1)
          positions[id].x += best.side * best.push;
      }
      for (const existing of slots) {
        if (
          best.side > 0
            ? existing.x >= best.threshold - 0.1
            : existing.x <= best.threshold + 0.1
        )
          existing.x += best.side * best.push;
      }
    }
    let origin = best.origin;
    if (best.blocked) {
      const size = slotSize(mode);
      const step = mode === "horizontal" ? 70 : 70;
      for (let distance = 1; distance < 8 && best.blocked; distance++) {
        const candidate =
          mode === "horizontal"
            ? { x: origin.x, y: origin.y + best.side * step * distance }
            : { x: origin.x + best.side * step * distance, y: origin.y };
        const box = partnerSlotBox(candidate, mode);
        const blocked =
          routes.some((route) => polylineHitsRect(route, inflate(box, 4))) ||
          Object.entries(positions).some(
            ([id, point]) =>
              id !== person.id &&
              rectsOverlap(box, personFootprint(point, mode), 6),
          ) ||
          slots.some((existing) =>
            rectsOverlap(box, partnerSlotBox(existing, mode), 6),
          );
        if (!blocked) {
          origin = candidate;
          break;
        }
      }
    }
    slots.push({ id: person.id, ...origin });
  }
  return slots;
}

// Capture all views before a mutation so divorce, renaming or adding relatives
// cannot reorder existing people. Explicitly moved positions take precedence.
// Partner placeholders open space only while they are drawn, so a saved layout
// stays put when that option is off.
export function preserveLayout(previous: Family | null, next: Family): Family {
  const result = structuredClone(next);
  const stored = { partnerSlots: false };
  for (const mode of ["classic", "horizontal", "tapestry"] as const) {
    const before = previous
      ? layoutFamily(previous, mode, null, {}, stored).positions
      : {};
    for (const p of result.members)
      if (!p.positions?.[mode] && before[p.id])
        p.positions = { ...p.positions, [mode]: before[p.id] };
    const placed = layoutFamily(result, mode, null, {}, stored).positions;
    for (const p of result.members)
      p.positions = { ...p.positions, [mode]: placed[p.id] };
  }
  return result;
}
export interface Scene {
  positions: Record<string, Point>;
  slots: { id: string; x: number; y: number }[];
  unions: {
    id: string;
    a: Point;
    b: Point;
    joint: Point;
    branch: Point;
    marker: Point;
    children: Point[];
    childPaths?: string[];
    separated: boolean;
    ended: boolean;
    partnerPath?: string;
  }[];
  singles: { a: Point; b: Point }[];
  bounds: { x: number; y: number; width: number; height: number };
}
function generationRanks(f: Family): Record<string, number> {
  const ranks: Record<string, number> = {};
  const byId = new Map(f.members.map((person) => [person.id, person]));
  const children = new Map<string, string[]>();
  for (const person of f.members)
    for (const parent of person.parents)
      children.set(parent, [...(children.get(parent) ?? []), person.id]);
  const gen = (id: string): number => {
    if (ranks[id] !== undefined) return ranks[id];
    const person = byId.get(id)!;
    return (ranks[id] = person.parents.length
      ? 1 + Math.max(...person.parents.map(gen))
      : 0);
  };
  f.members.forEach((person) => gen(person.id));
  const blood = (id: string, next: (id: string) => string[]) => {
    const found = new Set<string>();
    const stack = [...next(id)];
    while (stack.length) {
      const current = stack.pop()!;
      if (found.has(current)) continue;
      found.add(current);
      stack.push(...next(current));
    }
    return found;
  };
  const parentsOf = (id: string) => byId.get(id)?.parents ?? [];
  const childrenOf = (id: string) => children.get(id) ?? [];
  // Pulling only the shallower partner down leaves their parents on the oldest
  // row and their siblings a generation above them. Shift that whole bloodline
  // so siblings stay level with the couple and parents stay one row above.
  const sideOf = (low: string, high: string) => {
    const blocked = new Set<string>([
      high,
      ...blood(high, parentsOf),
      ...blood(high, childrenOf),
    ]);
    const side = new Set<string>();
    const stack = [low];
    while (stack.length) {
      const id = stack.pop()!;
      if (side.has(id) || blocked.has(id)) continue;
      side.add(id);
      stack.push(...parentsOf(id), ...childrenOf(id));
    }
    if (!side.size) side.add(low);
    return side;
  };
  for (let i = 0; i < f.members.length; i++) {
    let changed = false;
    for (const union of f.unions) {
      const low = ranks[union.a] <= ranks[union.b] ? union.a : union.b;
      const high = low === union.a ? union.b : union.a;
      const delta = ranks[high] - ranks[low];
      if (!delta) continue;
      for (const id of sideOf(low, high)) ranks[id] += delta;
      changed = true;
    }
    for (const person of f.members) {
      const min = person.parents.length
        ? Math.max(...person.parents.map((id) => ranks[id])) + 1
        : 0;
      if (ranks[person.id] < min) {
        ranks[person.id] = min;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return ranks;
}

function arrangeMetrics(mode: Layout, partnerSlots: boolean) {
  if (mode === "horizontal")
    return {
      along: 120,
      rank: 180,
      slot: 0,
      memberGap: 36,
      groupGap: 88,
      pairGap: 120,
      rankGap: 150,
      originAlong: 0,
    };
  if (mode === "tapestry")
    return {
      along: 214,
      rank: 126,
      slot: 0,
      memberGap: 90,
      groupGap: 90,
      pairGap: 254,
      rankGap: 110,
      originAlong: -17,
    };
  return {
    along: 180,
    rank: 120,
    slot: partnerSlots ? 56 : 0,
    memberGap: 44,
    groupGap: 96,
    pairGap: 165,
    rankGap: 110,
    originAlong: 0,
  };
}

/**
 * Builds one view by generations: partners sit side by side, each sibling group
 * is centered under its parents, and unrelated branches keep their own width.
 * A couple whose parents belong to two different branches sits between those
 * branches, and each partner stands on the side of their own parents.
 */
export function arrangeFamily(
  family: Family,
  mode: Layout,
  partnerSlots = true,
): Record<string, Point> {
  const ranks = generationRanks(family);
  const metrics = arrangeMetrics(mode, partnerSlots);
  const memberById = new Map(family.members.map((person) => [person.id, person]));
  const seen = new Set<string>();
  const households: { ids: string[]; rank: number }[] = [];
  const ordered = [...family.members].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
  for (const person of ordered) {
    if (seen.has(person.id)) continue;
    const ids: string[] = [];
    const queue = [person.id];
    seen.add(person.id);
    while (queue.length) {
      const id = queue.shift()!;
      ids.push(id);
      for (const union of family.unions) {
        if (union.a !== id && union.b !== id) continue;
        const other = union.a === id ? union.b : union.a;
        if (ranks[other] !== ranks[id] || seen.has(other)) continue;
        seen.add(other);
        queue.push(other);
      }
    }
    households.push({ ids, rank: ranks[person.id] });
  }
  const parentIdsOf = (household: { ids: string[] }) => {
    const ids = new Set<string>();
    for (const id of household.ids)
      for (const parent of memberById.get(id)?.parents ?? [])
        if (memberById.has(parent)) ids.add(parent);
    return [...ids];
  };
  const contains = (household: { ids: string[] }, id: string) =>
    household.ids.includes(id);
  const exclusiveChildren = (household: { ids: string[]; rank: number }) =>
    households.filter((candidate) => {
      const parents = parentIdsOf(candidate);
      return (
        candidate.rank > household.rank &&
        parents.length > 0 &&
        parents.every((id) => contains(household, id))
      );
    });
  const needsSlot = (id: string) =>
    partnerSlots &&
    !family.unions.some(
      (union) =>
        union.status === "active" && (union.a === id || union.b === id),
    );
  const memberWidth = (id: string) =>
    metrics.along + (needsSlot(id) ? metrics.slot : 0);
  const householdWidth = (household: { ids: string[] }) => {
    const mixed =
      household.ids.length > 2 &&
      household.ids.some((id) =>
        family.unions.some(
          (union) =>
            union.status === "separated" &&
            (union.a === id || union.b === id),
        ),
      );
    return (
      household.ids.reduce((sum, id) => sum + memberWidth(id), 0) +
      metrics.memberGap * Math.max(0, household.ids.length - 1) +
      (mixed ? 56 : 0)
    );
  };
  const isCouple = (household: { ids: string[] }) =>
    household.ids.some((id) =>
      family.unions.some((union) => {
        const other = union.a === id ? union.b : union.a;
        return (
          (union.a === id || union.b === id) && household.ids.includes(other)
        );
      }),
    );
  const householdGap = (left: { ids: string[] }, right: { ids: string[] }) =>
    isCouple(left) && isCouple(right) ? metrics.pairGap : metrics.groupGap;
  const orderedChildren = (household: { ids: string[]; rank: number }) =>
    exclusiveChildren(household).sort((a, b) =>
      memberById
        .get(a.ids[0])!
        .name.localeCompare(memberById.get(b.ids[0])!.name, "de"),
    );
  const gapsBetween = (list: { ids: string[] }[]) =>
    list
      .slice(1)
      .reduce(
        (sum, household, index) => sum + householdGap(list[index], household),
        0,
      );
  const subtreeWidth = (household: { ids: string[]; rank: number }): number => {
    const kids = orderedChildren(household);
    const own = householdWidth(household);
    if (!kids.length) return own;
    const packed =
      kids.reduce((sum, kid) => sum + subtreeWidth(kid), 0) + gapsBetween(kids);
    return Math.max(own, packed);
  };
  const positions: Record<string, Point> = {};
  const placeHousehold = (
    household: { ids: string[]; rank: number },
    left: number,
  ) => {
    let ids = [...household.ids].sort((a, b) => {
      const center = (id: string) => {
        const parents = (memberById.get(id)?.parents ?? []).filter((parent) =>
          positions[parent],
        );
        if (!parents.length) return Number.POSITIVE_INFINITY;
        return (
          parents.reduce((sum, parent) => {
            const point = positions[parent];
            const along = mode === "horizontal" ? point.y : point.x;
            return sum + along + metrics.originAlong + metrics.along / 2;
          }, 0) / parents.length
        );
      };
      const delta = center(a) - center(b);
      return delta || memberById.get(a)!.name.localeCompare(memberById.get(b)!.name, "de");
    });
    const former = ids.filter((id) =>
      family.unions.some(
        (union) =>
          union.status === "separated" &&
          (union.a === id || union.b === id) &&
          ids.includes(union.a === id ? union.b : union.a),
      ),
    );
    const later = ids.filter((id) => !former.includes(id));
    const row = former.length && later.length ? former : ids;
    let cursor = left + Math.max(0, (householdWidth({ ids: row }) < householdWidth({ ids })
      ? (householdWidth({ ids }) - householdWidth({ ids: row })) / 2
      : 0));
    const rank = household.rank * (metrics.rank + metrics.rankGap);
    const nextRank = rank + metrics.rank + metrics.rankGap;
    for (const id of row) {
      const along = cursor - metrics.originAlong;
      positions[id] =
        mode === "horizontal" ? { x: rank, y: along } : { x: along, y: rank };
      cursor += memberWidth(id) + metrics.memberGap;
    }
    if (later.length && former.length) {
      const first = former[0];
      const last = former[former.length - 1];
      const firstAlong = mode === "horizontal" ? positions[first].y : positions[first].x;
      const lastAlong = mode === "horizontal" ? positions[last].y : positions[last].x;
      later.forEach((id, index) => {
        const owner = family.unions.find(
          (union) =>
            union.status === "active" &&
            (union.a === id || union.b === id) &&
            former.includes(union.a === id ? union.b : union.a),
        );
        const mateId = owner
          ? owner.a === id
            ? owner.b
            : owner.a
          : first;
        const mateAlong = mode === "horizontal" ? positions[mateId].y : positions[mateId].x;
        const leftSide = mateAlong <= (firstAlong + lastAlong) / 2;
        const outer = leftSide
          ? mateAlong - metrics.along - metrics.memberGap - (needsSlot(id) ? metrics.slot : 0)
          : mateAlong + memberWidth(mateId) + metrics.memberGap;
        const along = outer + index * (metrics.along + metrics.memberGap);
        const taken = Object.values(positions).some((point) => {
          const otherAlong = mode === "horizontal" ? point.y : point.x;
          const otherRank = mode === "horizontal" ? point.x : point.y;
          return (
            Math.abs(otherRank - rank) < 8 &&
            Math.abs(otherAlong - along) < metrics.along
          );
        });
        positions[id] = mode === "horizontal"
          ? taken
            ? { x: nextRank, y: mateAlong }
            : { x: rank, y: along }
          : taken
            ? { x: mateAlong, y: nextRank }
            : { x: along, y: rank };
      });
    }
  };
  const placeTree = (household: { ids: string[]; rank: number }, left: number, width: number) => {
    const own = householdWidth(household);
    placeHousehold(household, left + Math.max(0, (width - own) / 2));
    const kids = orderedChildren(household);
    if (!kids.length) return;
    const widths = kids.map(subtreeWidth);
    const total =
      widths.reduce((sum, item) => sum + item, 0) + gapsBetween(kids);
    let cursor = left + Math.max(0, (width - total) / 2);
    kids.forEach((kid, index) => {
      placeTree(kid, cursor, widths[index]);
      if (index < kids.length - 1)
        cursor += widths[index] + householdGap(kid, kids[index + 1]);
    });
  };
  const roots = households.filter((household) => parentIdsOf(household).length === 0);
  const index = new Map(roots.map((household, position) => [household, position]));
  const parent = roots.map((_, position) => position);
  const find = (position: number): number =>
    parent[position] === position ? position : (parent[position] = find(parent[position]));
  const unite = (a: number, b: number) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent[right] = left;
  };
  for (const household of households) {
    const hits = roots.filter((root) =>
      parentIdsOf(household).some((id) => contains(root, id)),
    );
    for (let i = 1; i < hits.length; i++) unite(index.get(hits[0])!, index.get(hits[i])!);
  }
  const clusters = new Map<number, typeof roots>();
  roots.forEach((household, position) => {
    const key = find(position);
    clusters.set(key, [...(clusters.get(key) ?? []), household]);
  });
  const sharedChildren = (cluster: typeof roots) => {
    const ids = new Set(cluster.flatMap((household) => household.ids));
    return households.filter((household) => {
      const parents = parentIdsOf(household);
      if (!parents.length || !parents.every((id) => ids.has(id))) return false;
      return !cluster.some((root) => parents.every((id) => contains(root, id)));
    });
  };
  let left = 0;
  let previousCouples = false;
  for (const cluster of clusters.values()) {
    const shared = sharedChildren(cluster).sort((a, b) =>
      memberById
        .get(a.ids[0])!
        .name.localeCompare(memberById.get(b.ids[0])!.name, "de"),
    );
    const couples = cluster.some(isCouple) || shared.some(isCouple);
    if (left > 0)
      left += previousCouples && couples ? metrics.pairGap : metrics.groupGap;
    const rootWidths = cluster.map(subtreeWidth);
    const sharedWidths = shared.map(subtreeWidth);
    const rootsRow =
      rootWidths.reduce((sum, width) => sum + width, 0) + gapsBetween(cluster);
    const sharedRow =
      sharedWidths.reduce((sum, width) => sum + width, 0) + gapsBetween(shared);
    const width = Math.max(rootsRow, sharedRow, 0);
    let cursor = left + Math.max(0, (width - rootsRow) / 2);
    cluster.forEach((household, position) => {
      placeTree(household, cursor, rootWidths[position]);
      if (position < cluster.length - 1)
        cursor +=
          rootWidths[position] + householdGap(household, cluster[position + 1]);
    });
    cursor = left + Math.max(0, (width - sharedRow) / 2);
    shared.forEach((household, position) => {
      placeTree(household, cursor, sharedWidths[position]);
      if (position < shared.length - 1)
        cursor +=
          sharedWidths[position] + householdGap(household, shared[position + 1]);
    });
    left += width;
    previousCouples = couples;
  }
  const alongCenter = (id: string) => {
    const point = positions[id];
    const along = mode === "horizontal" ? point.y : point.x;
    return along + metrics.originAlong + metrics.along / 2;
  };
  const parentAnchor = (household: { ids: string[] }) => {
    const parents = parentIdsOf(household).filter((id) => positions[id]);
    if (!parents.length) return null;
    return parents.reduce((sum, id) => sum + alongCenter(id), 0) / parents.length;
  };
  // A couple can belong to two branches at once, so neither branch claims it
  // while the trees are packed. Seat it directly beside the siblings already
  // on that row, and pull the other branch in to the same gap.
  const alongKey = mode === "horizontal" ? "y" : "x";
  const visualLeftOf = (id: string) => positions[id][alongKey] + metrics.originAlong;
  const visualRightOf = (id: string) => visualLeftOf(id) + memberWidth(id);
  const placedComponent = (seeds: string[], blocked: Set<string>) => {
    const found = new Set<string>();
    const stack = [...seeds];
    while (stack.length) {
      const id = stack.pop()!;
      if (found.has(id) || blocked.has(id) || !positions[id]) continue;
      found.add(id);
      const person = memberById.get(id);
      stack.push(...(person?.parents ?? []));
      for (const member of family.members)
        if (member.parents.includes(id)) stack.push(member.id);
      for (const union of family.unions) {
        if (union.a === id) stack.push(union.b);
        else if (union.b === id) stack.push(union.a);
      }
    }
    return found;
  };
  const seatOpen = (household: { ids: string[]; rank: number }) => {
    const own = householdWidth(household);
    const parents = parentIdsOf(household)
      .filter((id) => positions[id])
      .sort((a, b) => alongCenter(a) - alongCenter(b));
    const sameHouse = (a: string, b: string) =>
      households.some((item) => item.ids.includes(a) && item.ids.includes(b));
    let splitAt = -1;
    let widest = -1;
    for (let i = 1; i < parents.length; i++) {
      if (sameHouse(parents[i - 1], parents[i])) continue;
      const gap = alongCenter(parents[i]) - alongCenter(parents[i - 1]);
      if (gap > widest) {
        widest = gap;
        splitAt = i;
      }
    }
    const blocked = new Set(household.ids);
    const leftIds = splitAt > 0 ? placedComponent(parents.slice(0, splitAt), blocked) : new Set<string>();
    const rightIds = splitAt > 0 ? placedComponent(parents.slice(splitAt), blocked) : new Set<string>();
    const separate =
      leftIds.size > 0 &&
      rightIds.size > 0 &&
      [...leftIds].every((id) => !rightIds.has(id));
    if (!separate) {
      placeHousehold(household, parentAnchor(household)! - own / 2);
      return;
    }
    const rankById = new Map(
      households.flatMap((item) => item.ids.map((id) => [id, item.rank])),
    );
    const siblingsOf = (person: string, ids: Set<string>) => {
      const parents = new Set(memberById.get(person)?.parents ?? []);
      return [...ids].filter(
        (id) =>
          rankById.get(id) === household.rank &&
          (memberById.get(id)?.parents ?? []).some((parent) => parents.has(parent)),
      );
    };
    const partnerIn = (ids: Set<string>) =>
      household.ids.find((id) =>
        (memberById.get(id)?.parents ?? []).some((parent) => ids.has(parent)),
      );
    const leftSiblings = partnerIn(leftIds) ? siblingsOf(partnerIn(leftIds)!, leftIds) : [];
    const rightSiblings = partnerIn(rightIds) ? siblingsOf(partnerIn(rightIds)!, rightIds) : [];
    // A partner whose family is only an ancestor line stands on that side.
    // Park the line outside the birth family and put that partner beside it.
    // The birth siblings move in to the normal gap; a cousin stays under
    // their own parents instead of filling the hole.
    if (
      (leftSiblings.length > 0 && rightSiblings.length === 0) ||
      (rightSiblings.length > 0 && leftSiblings.length === 0)
    ) {
      const birth = leftSiblings.length ? leftIds : rightIds;
      const inlaw = birth === leftIds ? rightIds : leftIds;
      const anchor = [...inlaw].reduce((a, b) =>
        (rankById.get(a) ?? 0) >= (rankById.get(b) ?? 0) ? a : b,
      );
      const inlawLeft = Math.min(...[...inlaw].map(visualLeftOf));
      const birthLeft = Math.min(...[...birth].map(visualLeftOf));
      const inlawDelta = Math.min(inlawLeft, birthLeft) - inlawLeft;
      for (const id of inlaw) positions[id][alongKey] += inlawDelta;
      const slot = visualLeftOf(anchor);
      const siblings = leftSiblings.length ? leftSiblings : rightSiblings;
      const nearest = siblings.reduce((a, b) =>
        visualLeftOf(a) <= visualLeftOf(b) ? a : b,
      );
      const siblingHouse = households.find((item) => item.ids.includes(nearest));
      const coupleRight = slot + own;
      const gapSibling = siblingHouse
        ? householdGap(household, siblingHouse)
        : metrics.groupGap;
      let birthDelta = coupleRight + gapSibling - visualLeftOf(nearest);
      const sameRow = (a: string, b: string) => {
        const rankOf = (id: string) =>
          mode === "horizontal" ? positions[id].x : positions[id].y;
        return Math.abs(rankOf(a) - rankOf(b)) <= 8;
      };
      const alongSep = (a: string, b: string) =>
        anchorSeparation(mode, gapKind(family, a, b))[alongKey];
      for (const birthId of birth)
        for (const inlawId of inlaw) {
          if (!positions[birthId] || !positions[inlawId] || !sameRow(birthId, inlawId))
            continue;
          const limit =
            visualLeftOf(inlawId) +
            alongSep(inlawId, birthId) -
            visualLeftOf(birthId);
          if (limit > birthDelta) birthDelta = limit;
        }
      if (Math.abs(birthDelta) > 0.5)
        for (const id of birth) positions[id][alongKey] += birthDelta;
      placeHousehold(household, slot);
      left = Math.max(left, ...Object.keys(positions).map((id) => visualRightOf(id)));
      return;
    }
    const onThisRow = (ids: Set<string>) => {
      const same = [...ids].filter((id) => rankById.get(id) === household.rank);
      return same.length ? same : [...ids];
    };
    const rightmost = onThisRow(leftIds).reduce((a, b) =>
      visualRightOf(a) >= visualRightOf(b) ? a : b,
    );
    const leftmost = onThisRow(rightIds).reduce((a, b) =>
      visualLeftOf(a) <= visualLeftOf(b) ? a : b,
    );
    const leftHouse = households.find((item) => item.ids.includes(rightmost));
    const rightHouse = households.find((item) => item.ids.includes(leftmost));
    if (!leftHouse || !rightHouse) {
      placeHousehold(household, parentAnchor(household)! - own / 2);
      return;
    }
    const gapLeft = householdGap(leftHouse, household);
    const gapRight = householdGap(household, rightHouse);
    const slot = visualRightOf(rightmost) + gapLeft;
    const delta = slot + own + gapRight - visualLeftOf(leftmost);
    if (delta > 0.5) {
      const cut = visualLeftOf(leftmost);
      for (const id of Object.keys(positions)) {
        if (leftIds.has(id)) continue;
        if (rightIds.has(id) || visualLeftOf(id) >= cut - 0.5)
          positions[id][alongKey] += delta;
      }
      left = Math.max(left, ...Object.keys(positions).map((id) => visualRightOf(id)));
    } else if (delta < -0.5) {
      for (const id of rightIds) positions[id][alongKey] += delta;
    }
    placeHousehold(household, slot);
  };
  const crossOf = (id: string) =>
    mode === "horizontal" ? positions[id].x : positions[id].y;
  // Shared children can land on top of the siblings already under one parent.
  // Nudge that household along the row before the couple takes its place, or
  // the later overlap pass shoves the couple past the brother or sister.
  const placedIds = () => Object.keys(positions);
  for (let pass = 0; pass < placedIds().length + 1; pass++) {
    const row = placedIds().sort(
      (a, b) => positions[a][alongKey] - positions[b][alongKey],
    );
    let moved = false;
    for (let i = 1; i < row.length; i++) {
      const previous = row[i - 1];
      const next = row[i];
      if (Math.abs(crossOf(previous) - crossOf(next)) > 8) continue;
      const minimum = anchorSeparation(
        mode,
        gapKind(family, previous, next),
      )[alongKey];
      const gap = positions[next][alongKey] - positions[previous][alongKey];
      if (gap >= minimum - 0.5) continue;
      const need = minimum - gap;
      for (const id of unionMates(family, next)) {
        if (!positions[id] || Math.abs(crossOf(id) - crossOf(next)) > 8) continue;
        positions[id][alongKey] += need;
      }
      moved = true;
      break;
    }
    if (!moved) break;
  }
  let open = households.filter((household) =>
    household.ids.some((id) => !positions[id]),
  );
  let progressed = true;
  while (progressed) {
    progressed = false;
    const ready = open
      .filter(
        (household) =>
          household.ids.every((id) => !positions[id]) && parentAnchor(household) !== null,
      )
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          parentAnchor(a)! - parentAnchor(b)! ||
          memberById
            .get(a.ids[0])!
            .name.localeCompare(memberById.get(b.ids[0])!.name, "de"),
      );
    for (const household of ready) {
      if (household.ids.some((id) => positions[id])) continue;
      seatOpen(household);
      progressed = true;
    }
    open = open.filter((household) => household.ids.some((id) => !positions[id]));
  }
  for (const household of open) {
    const missing = household.ids.filter((id) => !positions[id]);
    if (missing.length === household.ids.length) {
      placeHousehold(household, left);
      left += householdWidth(household) + metrics.groupGap;
      continue;
    }
    missing.forEach((id, index) => {
      const along =
        left + index * (metrics.along + metrics.groupGap) - metrics.originAlong;
      const rank = household.rank * (metrics.rank + metrics.rankGap);
      positions[id] =
        mode === "horizontal" ? { x: rank, y: along } : { x: along, y: rank };
    });
    left += missing.length * (metrics.along + metrics.groupGap);
  }
  resolveOverlaps(positions, family, mode);
  holdDynastyWalls(family, positions, mode);
  return positions;
}

function unionMates(family: Family, id: string) {
  const mates = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    if (mates.has(current)) continue;
    mates.add(current);
    for (const union of family.unions) {
      if (union.a !== current && union.b !== current) continue;
      queue.push(union.a === current ? union.b : union.a);
    }
  }
  return mates;
}

function resolveOverlaps(
  positions: Record<string, Point>,
  family: Family,
  mode: Layout,
) {
  const ids = Object.keys(positions);
  const along = mode === "horizontal" ? "y" : "x";
  for (let pass = 0; pass < ids.length * 3 + 2; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i],
          idB = ids[j];
        const kind = gapKind(family, idA, idB);
        const sep = anchorSeparation(mode, kind);
        const a = positions[idA],
          b = positions[idB];
        if (Math.abs(a.x - b.x) >= sep.x || Math.abs(a.y - b.y) >= sep.y)
          continue;
        const leftId = a[along] <= b[along] ? idA : idB;
        const rightId = leftId === idA ? idB : idA;
        const need =
          sep[along] - (positions[rightId][along] - positions[leftId][along]);
        if (need <= 0.1) continue;
        const leftMates = unionMates(family, leftId);
        const rightMates = unionMates(family, rightId);
        const shared = [...rightMates].some((id) => leftMates.has(id));
        const shift = shared
          ? [rightId]
          : [...rightMates].filter((id) => !leftMates.has(id));
        for (const id of shift) positions[id][along] += need;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** The painted dynasty area: member cards, padding, and room for the corner mark. */
export function dynastyRegion(
  family: Family,
  founder: Person,
  positions: Record<string, Point>,
  mode: Layout,
): { ids: string[]; rect: Rect } | null {
  const ids = dynastyMembers(family, founder).filter((id) => positions[id]);
  if (!ids.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const id of ids) {
    const box = personFootprint(positions[id], mode);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  const pad = 26;
  const head = 54;
  const bottom = mode === "tapestry" ? 28 : 12;
  return {
    ids,
    rect: {
      x: minX - pad,
      y: minY - pad - head,
      w: Math.max(180, maxX - minX + pad * 2),
      h: maxY - minY + pad + head + bottom,
    },
  };
}

function rectsMeet(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Outsiders cannot sit inside a dynasty. The area is a wall and they move beside it. */
function holdDynastyWalls(
  family: Family,
  positions: Record<string, Point>,
  mode: Layout,
) {
  const along = mode === "horizontal" ? "y" : "x";
  const gap = 16;
  const travel = (box: Rect, rect: Rect) =>
    mode === "horizontal"
      ? {
          low: box.y + box.h + gap - rect.y,
          high: rect.y + rect.h + gap - box.y,
        }
      : {
          low: box.x + box.w + gap - rect.x,
          high: rect.x + rect.w + gap - box.x,
        };
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    const regions = family.members
      .filter((person) => person.dynasty)
      .map((person) => dynastyRegion(family, person, positions, mode))
      .filter((region): region is NonNullable<typeof region> => region !== null)
      .sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h);
    for (const region of regions) {
      const members = new Set(region.ids);
      const low: string[] = [];
      const high: string[] = [];
      for (const id of Object.keys(positions)) {
        if (members.has(id)) continue;
        const box = personFootprint(positions[id], mode);
        if (!rectsMeet(box, region.rect)) continue;
        const way = travel(box, region.rect);
        if (way.low <= way.high) low.push(id);
        else high.push(id);
      }
      const moves: Array<{ ids: string[]; delta: number; gate: number; toward: "low" | "high" }> = [];
      if (high.length) {
        moves.push({
          ids: high,
          toward: "high",
          gate: Math.min(...high.map((id) => positions[id][along])),
          delta: Math.max(...high.map((id) => travel(personFootprint(positions[id], mode), region.rect).high)),
        });
      }
      if (low.length) {
        moves.push({
          ids: low,
          toward: "low",
          gate: Math.max(...low.map((id) => positions[id][along])),
          delta: Math.min(
            ...low.map((id) => -travel(personFootprint(positions[id], mode), region.rect).low),
          ),
        });
      }
      const claimed = new Set<string>();
      for (const move of moves) {
        if (Math.abs(move.delta) <= 0.5) continue;
        for (const id of Object.keys(positions)) {
          if (members.has(id) || claimed.has(id)) continue;
          const at = positions[id][along];
          const onSide = move.toward === "high" ? at >= move.gate - 0.5 : at <= move.gate + 0.5;
          if (!onSide) continue;
          positions[id][along] += move.delta;
          claimed.add(id);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export function layoutFamily(
  f: Family,
  mode: Layout,
  _focus: string | null,
  overrides: Record<string, Point> = {},
  options: { partnerSlots?: boolean } = {},
): Scene {
  const horizontal = mode === "horizontal",
    positions: Record<string, Point> = {},
    ranks = generationRanks(f);
  const rows = new Map<number, typeof f.members>();
  f.members.forEach((p) => {
    const r = ranks[p.id] ?? 0;
    rows.set(r, [...(rows.get(r) || []), p]);
  });
  [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([rank, row]) => {
      row.sort((a, b) => a.name.localeCompare(b.name));
      const groups: string[][] = [],
        seen = new Set<string>();
      row.forEach((p) => {
        if (seen.has(p.id)) return;
        seen.add(p.id);
        const u = f.unions.find(
          (u) =>
            (u.a === p.id || u.b === p.id) &&
            !seen.has(u.a === p.id ? u.b : u.a),
        );
        const mate = u ? (u.a === p.id ? u.b : u.a) : null;
        const group = [p.id];
        if (mate && row.some((x) => x.id === mate) && !seen.has(mate)) {
          group.push(mate);
          seen.add(mate);
        }
        groups.push(group);
      });
      {
        const ancestryPosition = (group: string[]) => {
          const parents = group
            .flatMap((id) => f.members.find((p) => p.id === id)!.parents)
            .map((id) => positions[id])
            .filter(Boolean);
          if (!parents.length) return Number.POSITIVE_INFINITY;
          return (
            parents.reduce((sum, p) => sum + (horizontal ? p.y : p.x), 0) /
            parents.length
          );
        };
        groups.sort((a, b) => {
          const aa = ancestryPosition(a),
            bb = ancestryPosition(b);
          return aa === bb ? 0 : aa - bb;
        });
      }
      groups.forEach((group, i) => {
        const base = (i - (groups.length - 1) / 2) * 480 - 110;
        group.forEach(
          (id, j) =>
            (positions[id] = horizontal
              ? { x: rank * 340, y: base + j * cardSeparation(mode).y }
              : {
                  x: base + j * cardSeparation(mode).x,
                  y: rank * 250,
                }),
        );
      });
    });
  const defaults = { ...positions };
  for (const id of Object.keys(positions)) delete positions[id];
  for (const p of f.members) {
    const saved = overrides[p.id] || p.positions?.[mode];
    if (saved) positions[p.id] = { ...saved };
  }
  if (!Object.keys(positions).length) {
    // On first opening, retain ancestry ordering from the automatic layout.
    // Subsequent changes fill only genuinely new positions around that layout.
    const ordered = [...f.members].sort(
      (a, b) =>
        ranks[a.id] - ranks[b.id] ||
        (horizontal
          ? defaults[a.id].y - defaults[b.id].y
          : defaults[a.id].x - defaults[b.id].x),
    );
    for (const p of ordered) {
      const target = { ...defaults[p.id] };
      let collisions: Point[];
      while (
        (collisions = Object.values(positions).filter((other) =>
          positionsOverlap(target, other, mode),
        )).length
      ) {
        if (horizontal)
          target.y = Math.max(...collisions.map((p) => p.y)) + cardSeparation(mode).y;
        else
          target.x =
            Math.max(...collisions.map((p) => p.x)) + cardSeparation(mode).x;
      }
      positions[p.id] = target;
    }
  }
  const pending = f.members.filter((p) => !positions[p.id]);
  while (pending.length) {
    // Place partners/children beside known relatives before unrelated people.
    const related = pending.findIndex(
      (p) =>
        f.unions.some(
          (u) =>
            (u.a === p.id && positions[u.b]) ||
            (u.b === p.id && positions[u.a]),
        ) || p.parents.some((id) => positions[id]),
    );
    const p = pending.splice(Math.max(0, related), 1)[0];
    const mate = f.unions.find(
      (u) =>
        (u.a === p.id && positions[u.b]) || (u.b === p.id && positions[u.a]),
    );
    const occupied = Object.values(positions);
    if (mate)
      positions[p.id] = partnerPosition(
        positions[mate.a === p.id ? mate.b : mate.a],
        occupied,
        mode,
      );
    else {
      const parent = p.parents.map((id) => positions[id]).find(Boolean);
      const child = f.members.find(
        (c) => c.parents.includes(p.id) && positions[c.id],
      );
      const relative = parent || (child && positions[child.id]);
      const direction = parent ? 1 : -1;
      const target = relative
        ? {
            x: relative.x + (horizontal ? direction * 340 : 0),
            y: relative.y + (horizontal ? 0 : direction * 250),
          }
        : defaults[p.id];
      positions[p.id] =
        relative &&
        occupied.some((other) => positionsOverlap(target, other, mode))
          ? partnerPosition(target, occupied, mode)
          : freePosition(target, occupied, mode);
    }
  }
  holdDynastyWalls(f, positions, mode);
  const center = (id: string) => ({
    x: positions[id].x + 90,
    y: positions[id].y + (mode === "tapestry" ? 35 : 60),
  });
  const cardObstacles = Object.values(positions).map((point) =>
    inflate(personFootprint(point, mode)),
  );
  const unions = f.unions.map((u) => {
    const link = smoothLink(positions[u.a], positions[u.b], mode);
    let marker = besideConnection(link.a, link.b, link.mid, mode);
    if (!markerClear(marker, cardObstacles)) {
      const flipped = {
        x: link.mid.x - (marker.x - link.mid.x),
        y: link.mid.y - (marker.y - link.mid.y),
      };
      marker = markerClear(flipped, cardObstacles)
        ? flipped
        : { ...link.mid };
    }
    return {
      id: u.id,
      partnerPath: link.d,
      a: link.a,
      b: link.b,
      joint: link.mid,
      branch: link.mid,
      marker,
      children: childrenOf(f, u).map((p) =>
        connectionPort(
          positions[p.id],
          childStart(
            link.mid,
            [positions[u.a], positions[u.b]],
            positions[p.id],
            mode,
          ),
          mode,
        ),
      ),
      childPaths: childrenOf(f, u).map((p) =>
        childConnector(
          link.mid,
          positions[p.id],
          [positions[u.a], positions[u.b]],
          mode,
        ),
      ),
      separated: u.status === "separated",
      ended: u.ended,
    };
  });
  const slots =
    options.partnerSlots === false
      ? []
      : placePartnerSlots(positions, f, mode, new Set(Object.keys(overrides)));
  const singles = f.members
    .filter((p) => p.parents.length === 1)
    .map((p) => {
      const b = center(p.id),
        a = connectionPort(positions[p.parents[0]], b, mode);
      return {
        a,
        b: connectionPort(positions[p.id], a, mode),
      };
    });
  const all = [
    ...Object.values(positions),
    ...slots,
    ...unions.flatMap((u) => [u.joint, u.branch]),
  ];
  const x = Math.min(0, ...all.map((p) => p.x)) - 55,
    y = Math.min(0, ...all.map((p) => p.y)) - 55;
  return {
    positions,
    slots,
    unions,
    singles,
    bounds: {
      x,
      y,
      width: Math.max(0, ...all.map((p) => p.x)) + 255 - x,
      height: Math.max(0, ...all.map((p) => p.y)) + 220 - y,
    },
  };
}

const pathNumber = (value: number) => Math.round(value * 10) / 10;

/** Smooth connector with tangents along the longer axis, in the manner of n8n. */
export function flowingConnector(a: Point, b: Point): string {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    vertical = Math.abs(dy) >= Math.abs(dx),
    along = vertical ? dy : dx,
    handle = Math.max(32, Math.min(Math.abs(along) * 0.45, 160)),
    sign = along >= 0 ? 1 : -1;
  return vertical
    ? `M${pathNumber(a.x)},${pathNumber(a.y)}C${pathNumber(a.x)},${pathNumber(a.y + sign * handle)} ${pathNumber(b.x)},${pathNumber(b.y - sign * handle)} ${pathNumber(b.x)},${pathNumber(b.y)}`
    : `M${pathNumber(a.x)},${pathNumber(a.y)}C${pathNumber(a.x + sign * handle)},${pathNumber(a.y)} ${pathNumber(b.x - sign * handle)},${pathNumber(b.y)} ${pathNumber(b.x)},${pathNumber(b.y)}`;
}

/** Orthogonal route with the largest corner curves the segments allow. */
export function softRoute(points: Point[], radius = 72): string {
  const route = points.filter(
    (point, index) =>
      index === 0 ||
      Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) >
        0.5,
  );
  if (route.length === 0) return "";
  if (route.length === 1) return `M${pathNumber(route[0].x)},${pathNumber(route[0].y)}`;
  let path = `M${pathNumber(route[0].x)},${pathNumber(route[0].y)}`;
  for (let index = 1; index < route.length - 1; index++) {
    const previous = route[index - 1],
      corner = route[index],
      next = route[index + 1],
      incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y),
      outgoing = Math.hypot(next.x - corner.x, next.y - corner.y),
      curve = Math.min(radius, incoming / 2, outgoing / 2);
    if (curve < 1) {
      path += `L${pathNumber(corner.x)},${pathNumber(corner.y)}`;
      continue;
    }
    const enter = {
        x: corner.x - ((corner.x - previous.x) / incoming) * curve,
        y: corner.y - ((corner.y - previous.y) / incoming) * curve,
      },
      leave = {
        x: corner.x + ((next.x - corner.x) / outgoing) * curve,
        y: corner.y + ((next.y - corner.y) / outgoing) * curve,
      },
      bend = 0.5523,
      controlIn = {
        x: enter.x + (corner.x - enter.x) * bend,
        y: enter.y + (corner.y - enter.y) * bend,
      },
      controlOut = {
        x: leave.x + (corner.x - leave.x) * bend,
        y: leave.y + (corner.y - leave.y) * bend,
      };
    path += `L${pathNumber(enter.x)},${pathNumber(enter.y)}C${pathNumber(controlIn.x)},${pathNumber(controlIn.y)} ${pathNumber(controlOut.x)},${pathNumber(controlOut.y)} ${pathNumber(leave.x)},${pathNumber(leave.y)}`;
  }
  const end = route[route.length - 1];
  return `${path}L${pathNumber(end.x)},${pathNumber(end.y)}`;
}

function stepFor(mode: Layout) {
  const sep = cardSeparation(mode);
  return mode === "horizontal" ? sep.y : sep.x;
}

function partnersOf(family: Family, id: string) {
  return family.unions
    .filter((union) => union.a === id || union.b === id)
    .map((union) => (union.a === id ? union.b : union.a));
}

function hasActivePartner(family: Family, id: string) {
  return family.unions.some(
    (union) =>
      union.status === "active" && (union.a === id || union.b === id),
  );
}

function preferredAncestorPoint(
  person: Point,
  beside: Point | undefined,
  mode: Layout,
): Point {
  const step = stepFor(mode);
  if (mode === "horizontal") {
    if (!beside) return { x: person.x - 340, y: person.y };
    const side = person.y <= beside.y ? -1 : 1;
    return { x: beside.x, y: beside.y + side * 160 };
  }
  if (!beside) return { x: person.x, y: person.y - 250 };
  const side = person.x <= beside.x ? -1 : 1;
  return { x: beside.x + side * step, y: beside.y };
}

/** Empty ancestor places for the person who asked, not automatically for their partner. */
export function ancestorSlotsFor(
  family: Family,
  positions: Record<string, Point>,
  focusId: string,
  mode: Layout,
  extra: Point[] = [],
) {
  const focus = family.members.find((person) => person.id === focusId);
  if (!focus || !positions[focusId] || focus.parents.length >= 2) return [];
  const occupied = [...Object.values(positions), ...extra];
  const knownParent = focus.parents.map((id) => positions[id]).find(Boolean);
  if (focus.parents.length === 1 && knownParent) {
    const parentId = focus.parents.find((id) => positions[id]);
    if (parentId && !hasActivePartner(family, parentId)) return [];
  }
  const related =
    knownParent ||
    partnersOf(family, focus.id)
      .flatMap(
        (id) => family.members.find((member) => member.id === id)?.parents || [],
      )
      .map((id) => positions[id])
      .find(Boolean);
  const point = freePosition(
    preferredAncestorPoint(positions[focus.id], related, mode),
    occupied,
    mode,
  );
  return [
    {
      personId: focus.id,
      index: focus.parents.length,
      ...point,
    },
  ];
}

/** One cubic between the facing sides of two cards. The curve leaves each side straight out. */
export function smoothLink(from: Point, to: Point, mode: Layout) {
  const { port, into } = facingPorts(from, to, mode);
  const span = Math.hypot(into.x - port.x, into.y - port.y);
  const along = port.dx !== 0 ? Math.abs(into.x - port.x) : Math.abs(into.y - port.y);
  const handle = Math.max(36, along * 0.5, span * 0.22);
  const c1 = { x: port.x + port.dx * handle, y: port.y + port.dy * handle },
    c2 = { x: into.x + into.dx * handle, y: into.y + into.dy * handle };
  const n = pathNumber;
  const mid = {
    x: 0.125 * port.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * into.x,
    y: 0.125 * port.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * into.y,
  };
  return {
    d: `M${n(port.x)},${n(port.y)}C${n(c1.x)},${n(c1.y)} ${n(c2.x)},${n(c2.y)} ${n(into.x)},${n(into.y)}`,
    a: { x: port.x, y: port.y },
    b: { x: into.x, y: into.y },
    mid,
    route: [port, mid, into],
  };
}

/** Partnership path that stays off other cards, slots and already drawn lines. */
export function clearLink(
  from: Point,
  to: Point,
  mode: Layout,
  obstacles: Rect[] = [],
  others: Point[][] = [],
) {
  const { port, into } = facingPorts(from, to, mode);
  const own = expandRect(personFootprint(from, mode), 4);
  const mate = expandRect(personFootprint(to, mode), 4);
  const blockers = obstacles.filter(
    (rect) => !rectsOverlap(rect, own, 0) && !rectsOverlap(rect, mate, 0),
  );
  const straight = smoothLink(from, to, mode);
  if (
    !routeHitsObstacles(straight.route, blockers) &&
    !others.some((route) => polylinesCross(straight.route, route))
  )
    return straight;
  const detour = detourRoute(
    { x: port.x, y: port.y },
    { x: into.x, y: into.y },
    blockers,
    others,
  );
  const mid = routeMid(detour);
  return {
    d: softRoute(detour),
    a: { x: port.x, y: port.y },
    b: { x: into.x, y: into.y },
    mid,
    route: detour,
  };
}

/** Puts the child control beside the partnership instead of on the curve. */
export function besideConnection(
  a: Point,
  b: Point,
  mid: Point,
  mode: Layout,
): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1;
  let px = -dy / len,
    py = dx / len;
  if (mode === "horizontal" ? px < 0 : py < 0) {
    px = -px;
    py = -py;
  }
  return { x: mid.x + px * 42, y: mid.y + py * 42 };
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

export function tidyLayout(
  family: Family,
  mode: Layout,
  partnerSlots = true,
): Family {
  const next = structuredClone(family);
  for (const person of next.members) {
    if (!person.positions?.[mode]) continue;
    const positions = { ...person.positions };
    delete positions[mode];
    person.positions = Object.keys(positions).length ? positions : undefined;
  }
  const arranged = arrangeFamily(next, mode, partnerSlots);
  for (const person of next.members) {
    const point = arranged[person.id];
    if (!point) continue;
    person.positions = {
      ...person.positions,
      [mode]: { x: point.x, y: point.y },
    };
  }
  return next;
}

export function branchMarkerPosition(
  joint: Point,
  branch: Point,
  ended: boolean,
): Point {
  return ended
    ? { x: (joint.x + branch.x) / 2, y: (joint.y + branch.y) / 2 }
    : { ...branch };
}

// Connect to the visible card, including the tapestry name ribbon.
export function connectionPort(
  position: Point,
  toward: Point,
  mode: Layout,
): Point {
  const box = personFootprint(position, mode);
  const cx = box.x + box.w / 2,
    cy = box.y + box.h / 2;
  const dx = toward.x - cx,
    dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Leave the couple in the corridor, then below or beside both cards and ribbons. */
function childStart(
  joint: Point,
  parents: Point[],
  toward: Point,
  mode: Layout,
): Point {
  const boxes = parents.map((point) => expandRect(personFootprint(point, mode), 6));
  let start = { ...joint };
  const dx = toward.x - start.x,
    dy = toward.y - start.y,
    len = Math.hypot(dx, dy) || 1;
  const step = { x: dx / len, y: dy / len };
  for (let i = 0; i < 48 && boxes.some((box) => pointInRect(start, box)); i++)
    start = { x: start.x + step.x * 8, y: start.y + step.y * 8 };
  if (mode === "horizontal") {
    const right = toward.x >= start.x;
    const edge = right
      ? Math.max(start.x, ...boxes.map((box) => box.x + box.w))
      : Math.min(start.x, ...boxes.map((box) => box.x));
    return { x: edge, y: start.y };
  }
  const below = toward.y >= start.y;
  const edge = below
    ? Math.max(start.y, ...boxes.map((box) => box.y + box.h))
    : Math.min(start.y, ...boxes.map((box) => box.y));
  return { x: start.x, y: edge };
}

function childConnector(
  joint: Point,
  child: Point,
  parents: Point[],
  mode: Layout,
): string {
  const start = childStart(joint, parents, child, mode);
  const into = connectionPort(child, start, mode);
  const boxes = parents.map((point) => expandRect(personFootprint(point, mode), 4));
  const stemBlocked =
    boxes.some((box) => pointInRect(joint, box) || segmentHitsRect(joint, start, box));
  if (stemBlocked || Math.hypot(start.x - joint.x, start.y - joint.y) < 3)
    return flowingConnector(start, into);
  const stem = flowingConnector(joint, start);
  const branch = flowingConnector(start, into);
  const curve = branch.indexOf("C");
  return curve >= 0 ? stem + branch.slice(curve) : stem;
}
