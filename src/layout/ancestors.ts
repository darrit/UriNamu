import { type Layout, type Point } from "./types";
import { cardSeparation, freePosition } from "./spacing";
import { type Family } from "../domain";

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
    (union) => union.status === "active" && (union.a === id || union.b === id),
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
        (id) =>
          family.members.find((member) => member.id === id)?.parents || [],
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
