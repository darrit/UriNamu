import { type Layout, type Point } from "./types";
import {
  slotSize,
  personFootprint,
  personFace,
  partnerSlotBox,
  inflate,
  rectsOverlap,
  polylineHitsRect,
} from "./geometry";
import { type Family } from "../domain";

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
  let threshold =
    side > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  for (const [id, point] of Object.entries(positions)) {
    if (id === anchorId) continue;
    if (!rectsOverlap(slot, personFootprint(point, mode))) continue;
    const rect = personFootprint(point, mode);
    const amount =
      side > 0 ? slot.x + slot.w + 8 - rect.x : rect.x + rect.w + 8 - slot.x;
    if (amount > push) push = amount;
    threshold =
      side > 0 ? Math.min(threshold, point.x) : Math.max(threshold, point.x);
  }
  for (const existing of slots) {
    const rect = partnerSlotBox(existing, mode);
    if (!rectsOverlap(slot, rect)) continue;
    const amount =
      side > 0 ? slot.x + slot.w + 8 - rect.x : rect.x + rect.w + 8 - slot.x;
    if (amount > push) push = amount;
    threshold =
      side > 0
        ? Math.min(threshold, existing.x)
        : Math.max(threshold, existing.x);
  }
  return { origin, push: Math.max(0, push), threshold };
}

/** Puts each free partner place directly beside its person, shifting neighbours when needed. */
export function placePartnerSlots(
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
        const clearance = slotClearance(
          positions,
          slots,
          person.id,
          side,
          mode,
        );
        const box = partnerSlotBox(clearance.origin, mode);
        const blocked = routes.some((route) =>
          polylineHitsRect(route, inflate(box, 4)),
        );
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
        if (
          best.side > 0 ? x >= best.threshold - 0.1 : x <= best.threshold + 0.1
        )
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
      const step = 70;
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
