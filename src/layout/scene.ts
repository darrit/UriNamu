import { type Layout, layoutModes, type Point, type Scene } from "./types";
import { personFootprint, inflate } from "./geometry";
import {
  cardSeparation,
  positionsOverlap,
  freePosition,
  partnerPosition,
} from "./spacing";
import {
  markerClear,
  smoothLink,
  besideConnection,
  connectionPort,
  childStart,
  childConnector,
} from "./routes";
import { placePartnerSlots } from "./partnerSlots";
import { generationRanks } from "./generations";
import { holdDynastyWalls } from "./dynasties";
import { type Family, childrenOf } from "../domain";

export function preserveLayout(previous: Family | null, next: Family): Family {
  const result = structuredClone(next);
  const stored = { partnerSlots: false };
  for (const mode of layoutModes) {
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
          target.y =
            Math.max(...collisions.map((p) => p.y)) + cardSeparation(mode).y;
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
  const center = (id: string) => {
    if (mode === "chart") {
      const box = personFootprint(positions[id], mode);
      return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    }
    return {
      x: positions[id].x + 90,
      y: positions[id].y + (mode === "tapestry" ? 35 : 60),
    };
  };
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
      marker = markerClear(flipped, cardObstacles) ? flipped : { ...link.mid };
    }
    const kids = childrenOf(f, u).map((p) => positions[p.id]);
    const parents = [positions[u.a], positions[u.b]];
    return {
      id: u.id,
      partnerPath: link.d,
      a: link.a,
      b: link.b,
      joint: link.mid,
      tangentAngle: link.angle,
      branch: link.mid,
      marker,
      children: kids.map((point) =>
        connectionPort(point, childStart(link.mid, parents, point, mode), mode),
      ),
      childPaths: kids.map((point) =>
        childConnector(link.mid, point, parents, mode),
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
