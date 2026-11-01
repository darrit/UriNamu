import { type Layout, type Point, type Rect } from "./types";
import { personFootprint } from "./geometry";
import { type Family, type Person, dynastyMembers } from "../domain";

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
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** Outsiders cannot sit inside a dynasty. The area is a wall and they move beside it. */
export function holdDynastyWalls(
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
      const moves: Array<{
        ids: string[];
        delta: number;
        gate: number;
        toward: "low" | "high";
      }> = [];
      if (high.length) {
        moves.push({
          ids: high,
          toward: "high",
          gate: Math.min(...high.map((id) => positions[id][along])),
          delta: Math.max(
            ...high.map(
              (id) =>
                travel(personFootprint(positions[id], mode), region.rect).high,
            ),
          ),
        });
      }
      if (low.length) {
        moves.push({
          ids: low,
          toward: "low",
          gate: Math.max(...low.map((id) => positions[id][along])),
          delta: Math.min(
            ...low.map(
              (id) =>
                -travel(personFootprint(positions[id], mode), region.rect).low,
            ),
          ),
        });
      }
      const claimed = new Set<string>();
      for (const move of moves) {
        if (Math.abs(move.delta) <= 0.5) continue;
        for (const id of Object.keys(positions)) {
          if (members.has(id) || claimed.has(id)) continue;
          const at = positions[id][along];
          const onSide =
            move.toward === "high"
              ? at >= move.gate - 0.5
              : at <= move.gate + 0.5;
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
