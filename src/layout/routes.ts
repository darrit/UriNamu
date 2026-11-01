import { type Layout, type Point, type Rect } from "./types";
import {
  personFootprint,
  expandRect,
  inflate,
  rectsOverlap,
  pointInRect,
  segmentHitsRect,
  polylineHitsRect,
  polylinesCross,
} from "./geometry";

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
    const length = route
      .slice(1)
      .reduce(
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

export function markerClear(point: Point, obstacles: Rect[]) {
  return !obstacles.some((rect) => pointInRect(point, inflate(rect, 6)));
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
  if (route.length === 1)
    return `M${pathNumber(route[0].x)},${pathNumber(route[0].y)}`;
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

/** One cubic between the facing sides of two cards. The curve leaves each side straight out. */
export function smoothLink(from: Point, to: Point, mode: Layout) {
  const { port, into } = facingPorts(from, to, mode);
  const span = Math.hypot(into.x - port.x, into.y - port.y);
  const along =
    port.dx !== 0 ? Math.abs(into.x - port.x) : Math.abs(into.y - port.y);
  const handle = Math.max(36, along * 0.5, span * 0.22);
  const c1 = { x: port.x + port.dx * handle, y: port.y + port.dy * handle },
    c2 = { x: into.x + into.dx * handle, y: into.y + into.dy * handle };
  return cubicPartnership(port, c1, c2, into);
}

/** Half the arc length, with the local tangent (also for asymmetric curves). */
function cubicPartnership(a: Point, c1: Point, c2: Point, b: Point) {
  const n = pathNumber;
  const at = (t: number): Point => {
    const s = 1 - t;
    return {
      x:
        s ** 3 * a.x +
        3 * s * s * t * c1.x +
        3 * s * t * t * c2.x +
        t ** 3 * b.x,
      y:
        s ** 3 * a.y +
        3 * s * s * t * c1.y +
        3 * s * t * t * c2.y +
        t ** 3 * b.y,
    };
  };
  const route = Array.from({ length: 201 }, (_, i) => at(i / 200));
  const lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y),
    );
  const half = lengths[lengths.length - 1] / 2;
  const index = Math.max(
    1,
    lengths.findIndex((length) => length >= half),
  );
  const t =
    (index -
      1 +
      (half - lengths[index - 1]) /
        (lengths[index] - lengths[index - 1] || 1)) /
    200;
  const s = 1 - t;
  const dx =
    3 * s * s * (c1.x - a.x) +
    6 * s * t * (c2.x - c1.x) +
    3 * t * t * (b.x - c2.x);
  const dy =
    3 * s * s * (c1.y - a.y) +
    6 * s * t * (c2.y - c1.y) +
    3 * t * t * (b.y - c2.y);
  return {
    d: `M${n(a.x)},${n(a.y)}C${n(c1.x)},${n(c1.y)} ${n(c2.x)},${n(c2.y)} ${n(b.x)},${n(b.y)}`,
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    mid: at(t),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    route,
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
  const scale =
    1 / Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Leave the couple in the corridor, then below or beside both cards and ribbons. */
export function childStart(
  joint: Point,
  parents: Point[],
  toward: Point,
  mode: Layout,
): Point {
  const boxes = parents.map((point) =>
    expandRect(personFootprint(point, mode), 6),
  );
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

export function childConnector(
  joint: Point,
  child: Point,
  parents: Point[],
  mode: Layout,
): string {
  const start = childStart(joint, parents, child, mode);
  const into = connectionPort(child, start, mode);
  const boxes = parents.map((point) =>
    expandRect(personFootprint(point, mode), 4),
  );
  const stemBlocked = boxes.some(
    (box) => pointInRect(joint, box) || segmentHitsRect(joint, start, box),
  );
  if (stemBlocked || Math.hypot(start.x - joint.x, start.y - joint.y) < 3)
    return flowingConnector(start, into);
  const stem = flowingConnector(joint, start);
  const branch = flowingConnector(start, into);
  const curve = branch.indexOf("C");
  return curve >= 0 ? stem + branch.slice(curve) : stem;
}
