import { type Layout, type Point } from "./types";
import { anchorSeparation, cardSeparation, gapKind } from "./spacing";
import { generationRanks } from "./generations";
import { arrangeFamily } from "./arrangement";
import { type Family, type Person } from "../domain";

export function tidyLayout(
  family: Family,
  mode: Layout,
  partnerSlots = true,
): Family {
  const next = structuredClone(family);
  const seated = next.members.every((person) => person.positions?.[mode]);
  const imported =
    seated &&
    (mode === "chart" ||
      next.members.every((person) => person.positions?.chart));
  const usableRows = seated && rowsAreUsable(next, mode);
  const arranged = imported
    ? compactChartRows(next, mode)
    : usableRows
      ? compactHierarchy(next, mode)
      : arrangeFromSeats(next, mode, partnerSlots);
  compactEmptyBands(arranged, mode);
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

/** Close empty space on both axes, including displaced imported generations.
 * Keep shared coordinates and ordering; each closed gap still fits the widest
 * required separation, so this cannot introduce a new card collision.
 */
function compactEmptyBands(points: Record<string, Point>, mode: Layout) {
  const values = Object.values(points);
  if (!values.length) return;
  const separation = anchorSeparation(mode, "pair");
  for (const axis of ["x", "y"] as const) {
    const generationAxis = axis === (mode === "horizontal" ? "x" : "y");
    const limit = Math.max(
      separation[axis] + 0.01,
      generationAxis ? (mode === "horizontal" ? 340 : 250) : 0,
    );
    const coordinates = [...new Set(values.map((point) => point[axis]))].sort(
      (a, b) => a - b,
    );
    const mapped = new Map<number, number>();
    let at = coordinates[0];
    mapped.set(at, at);
    for (let i = 1; i < coordinates.length; i++) {
      at += Math.min(coordinates[i] - coordinates[i - 1], limit);
      mapped.set(coordinates[i], at);
    }
    const min = coordinates[0],
      span = at - min;
    // The canvas includes the origin in its bounds. Do not leave a compact
    // tree millions of pixels away from it after dragging an extreme outlier.
    const offset = min > span + limit || at < -span - limit ? min : 0;
    for (const point of values) point[axis] = mapped.get(point[axis])! - offset;
  }
}

/** Compress shared columns without changing printed generations or branch order. */
function compactChartRows(
  family: Family,
  mode: Layout = "chart",
): Record<string, Point> {
  const along = mode === "horizontal" ? "y" : "x";
  const cross = mode === "horizontal" ? "x" : "y";
  const rows = new Map<number, Person[]>();
  for (const person of family.members) {
    const y = person.positions![mode]![cross];
    rows.set(y, [...(rows.get(y) ?? []), person]);
  }
  const before = new Map<string, Person>();
  for (const row of rows.values()) {
    row.sort((a, b) => a.positions![mode]![along] - b.positions![mode]![along]);
    row.slice(1).forEach((person, i) => before.set(person.id, row[i]));
  }
  const points: Record<string, Point> = {};
  const columns = new Map<number, Person[]>();
  for (const person of family.members) {
    const x = person.positions![mode]![along];
    columns.set(x, [...(columns.get(x) ?? []), person]);
  }
  let previous: number | undefined;
  let cursor = Math.min(...columns.keys());
  for (const [x, people] of [...columns].sort((a, b) => a[0] - b[0])) {
    if (previous !== undefined)
      cursor += Math.min(x - previous, cardSeparation(mode)[along]);
    for (const person of people) {
      const left = before.get(person.id);
      if (left && points[left.id])
        cursor = Math.max(
          cursor,
          points[left.id].x +
            anchorSeparation(mode, gapKind(family, left.id, person.id))[along] +
            0.01,
        );
    }
    const columnStart = cursor;
    for (const person of people) {
      const left = before.get(person.id);
      const at =
        left && points[left.id]
          ? Math.max(
              columnStart,
              points[left.id].x +
                anchorSeparation(mode, gapKind(family, left.id, person.id))[
                  along
                ] +
                0.01,
            )
          : columnStart;
      points[person.id] = { x: at, y: person.positions![mode]![cross] };
      cursor = Math.max(cursor, at);
    }
    previous = x;
  }
  if (mode === "horizontal")
    for (const point of Object.values(points)) {
      const x = point.x;
      point.x = point.y;
      point.y = x;
    }
  return points;
}

function arrangeFromSeats(family: Family, mode: Layout, partnerSlots: boolean) {
  const seat = new Map<string, number>();
  for (const person of family.members) {
    const point = person.positions?.[mode];
    if (point) seat.set(person.id, mode === "horizontal" ? point.y : point.x);
  }
  for (const person of family.members) {
    if (!person.positions?.[mode]) continue;
    const positions = { ...person.positions };
    delete positions[mode];
    person.positions = Object.keys(positions).length ? positions : undefined;
  }
  return arrangeFamily(family, mode, partnerSlots, seat);
}

/** People already share a generation row, so tidy can close gaps instead of rebuilding from the left. */
function rowsAreUsable(family: Family, mode: Layout) {
  const ranks = generationRanks(family);
  const byRank = new Map<number, number[]>();
  for (const person of family.members) {
    const point = person.positions?.[mode];
    if (!point) return false;
    const cross = mode === "horizontal" ? point.x : point.y;
    const rank = ranks[person.id] ?? 0;
    byRank.set(rank, [...(byRank.get(rank) ?? []), cross]);
  }
  for (const values of byRank.values()) {
    if (Math.max(...values) - Math.min(...values) > 80) return false;
  }
  return family.members.length > 0;
}

/**
 * Closes gaps toward the nearest person on the same rank.
 * A child or partner may stay where they were dragged while that place still
 * belongs to their parents. Outside that band they return beside their siblings.
 */
function compactHierarchy(family: Family, mode: Layout): Record<string, Point> {
  const ranks = generationRanks(family);
  const alongKey = mode === "horizontal" ? "y" : "x";
  const along = new Map<string, number>();
  const crossSaved = new Map<string, number>();
  for (const person of family.members) {
    const point = person.positions![mode]!;
    along.set(person.id, point[alongKey]);
    crossSaved.set(person.id, mode === "horizontal" ? point.x : point.y);
  }
  const original = new Map(along);
  const memberById = new Map(
    family.members.map((person) => [person.id, person]),
  );
  const rankIds = new Map<number, string[]>();
  for (const person of family.members) {
    const rank = ranks[person.id] ?? 0;
    rankIds.set(rank, [...(rankIds.get(rank) ?? []), person.id]);
  }
  const gap = (a: string, b: string) =>
    anchorSeparation(mode, gapKind(family, a, b))[alongKey];
  const ordered = (ids: string[]) =>
    [...ids].sort(
      (a, b) => along.get(a)! - along.get(b)! || a.localeCompare(b),
    );

  const closeGaps = (ids: string[]) => {
    const row = ordered(ids);
    for (let pass = 0; pass < row.length + 1; pass += 1) {
      const median =
        row.reduce((sum, id) => sum + along.get(id)!, 0) / row.length;
      for (let index = 0; index < row.length - 1; index += 1) {
        const left = row[index];
        const right = row[index + 1];
        const need = gap(left, right);
        const have = along.get(right)! - along.get(left)!;
        if (Math.abs(have - need) < 1) continue;
        const leftAway = Math.abs(along.get(left)! - median);
        const rightAway = Math.abs(along.get(right)! - median);
        if (have > need) {
          if (rightAway >= leftAway) along.set(right, along.get(left)! + need);
          else along.set(left, along.get(right)! - need);
        } else if (rightAway >= leftAway)
          along.set(right, along.get(left)! + need);
        else along.set(left, along.get(right)! - need);
      }
    }
  };

  type Unit = {
    ids: string[];
    parents: string[];
    anchor: number | null;
    parentLow: number | null;
    parentHigh: number | null;
    parentKey: string;
  };

  for (const rank of [...rankIds.keys()].sort((a, b) => a - b)) {
    const ids = rankIds.get(rank)!;
    const remaining = new Set(ids);
    const units: Unit[] = [];
    for (const start of ordered(ids)) {
      if (!remaining.has(start)) continue;
      const component: string[] = [];
      const queue = [start];
      while (queue.length) {
        const current = queue.pop()!;
        if (!remaining.has(current)) continue;
        remaining.delete(current);
        component.push(current);
        for (const union of family.unions) {
          const other =
            union.a === current ? union.b : union.b === current ? union.a : "";
          if (other && remaining.has(other)) queue.push(other);
        }
      }
      const parents = [
        ...new Set(component.flatMap((id) => memberById.get(id)!.parents)),
      ].filter((id) => along.has(id));
      const parentAlong = parents.map((id) => along.get(id)!);
      units.push({
        ids: component,
        parents,
        anchor: parentAlong.length
          ? parentAlong.reduce((sum, value) => sum + value, 0) /
            parentAlong.length
          : null,
        parentLow: parentAlong.length ? Math.min(...parentAlong) : null,
        parentHigh: parentAlong.length ? Math.max(...parentAlong) : null,
        parentKey: [...parents].sort().join("|"),
      });
    }

    const roots = units.filter((unit) => unit.anchor === null);
    if (roots.length) closeGaps(roots.flatMap((unit) => unit.ids));

    const groups = new Map<string, Unit[]>();
    for (const unit of units) {
      if (unit.anchor === null) continue;
      groups.set(unit.parentKey, [...(groups.get(unit.parentKey) ?? []), unit]);
    }
    for (const group of groups.values()) {
      const parents = group[0].parents;
      const parentShift =
        parents.reduce(
          (sum, id) => sum + along.get(id)! - original.get(id)!,
          0,
        ) / parents.length;
      const flat = group.flatMap((unit) => unit.ids);
      for (const id of flat) along.set(id, along.get(id)! + parentShift);
      const card = anchorSeparation(mode, "person")[alongKey];
      const siblingWidth = Math.max(0, flat.length - 1) * card;
      const low = group[0].parentLow! - siblingWidth - card;
      const high = group[0].parentHigh! + siblingWidth + card;
      const inside = flat.filter((id) => {
        const at = along.get(id)!;
        return at >= low && at <= high;
      });
      for (const unit of group) {
        const center =
          unit.ids.reduce((sum, id) => sum + along.get(id)!, 0) /
          unit.ids.length;
        if (center >= low && center <= high) continue;
        const nearest = inside.reduce<string | null>((best, id) => {
          if (!best) return id;
          return Math.abs(along.get(id)! - center) <
            Math.abs(along.get(best)! - center)
            ? id
            : best;
        }, null);
        const shift =
          (nearest ? along.get(nearest)! : group[0].anchor!) - center;
        for (const id of unit.ids) along.set(id, along.get(id)! + shift);
      }
      closeGaps(flat);
    }
    const blocks = [
      ...roots.map((unit) => ({
        ids: unit.ids,
        anchor:
          unit.ids.reduce((sum, id) => sum + along.get(id)!, 0) /
          unit.ids.length,
      })),
      ...[...groups.values()].map((group) => ({
        ids: group.flatMap((unit) => unit.ids),
        anchor: group[0].anchor!,
      })),
    ].sort(
      (a, b) =>
        Math.min(...a.ids.map((id) => along.get(id)!)) -
        Math.min(...b.ids.map((id) => along.get(id)!)),
    );
    for (let pass = 0; pass < blocks.length; pass += 1) {
      for (let index = 0; index < blocks.length - 1; index += 1) {
        const left = blocks[index];
        const right = blocks[index + 1];
        const leftEdge = left.ids.reduce((best, id) =>
          along.get(id)! > along.get(best)! ? id : best,
        );
        const rightEdge = right.ids.reduce((best, id) =>
          along.get(id)! < along.get(best)! ? id : best,
        );
        const have = along.get(rightEdge)! - along.get(leftEdge)!;
        const need = gap(leftEdge, rightEdge);
        if (have >= need) continue;
        const push = need - have;
        const moveRight =
          Math.abs(along.get(rightEdge)! - right.anchor) >=
          Math.abs(along.get(leftEdge)! - left.anchor);
        const target = moveRight ? right : left;
        const sign = moveRight ? 1 : -1;
        for (const id of target.ids)
          along.set(id, along.get(id)! + sign * push);
      }
    }
  }

  const points: Record<string, Point> = {};
  for (const person of family.members) {
    const rank = ranks[person.id] ?? 0;
    const crosses = (rankIds.get(rank) ?? [])
      .map((id) => crossSaved.get(id)!)
      .sort((a, b) => a - b);
    const cross = crosses[Math.floor(crosses.length / 2)] ?? 0;
    const at = along.get(person.id)!;
    points[person.id] =
      mode === "horizontal" ? { x: cross, y: at } : { x: at, y: cross };
  }
  return points;
}
