import { type Family, type Union } from "./domain";
import { anchorSeparation, cardSeparation, gapKind, positionsOverlap, type Layout, type Point } from "./layout";

export interface PartnerGroup {
  personId: string;
  primary: Union;
  additional: Union[];
  foldable: string[];
}

/** View-only grouping; never changes stored people, relationships or positions. */
export function partnerGroups(family: Family): PartnerGroup[] {
  const degree = (id: string) => family.unions.filter(u => u.a === id || u.b === id).length;
  return family.members.flatMap(person => {
    const unions = family.unions.filter(u => u.a === person.id || u.b === person.id);
    if (unions.length < 2 || !unions.some(u => u.marriage === "divorced")) return [];
    const hasChildren = (u: Union) => family.members.some(child => child.parents.includes(u.a) && child.parents.includes(u.b));
    unions.sort((a, b) => Number(hasChildren(b)) - Number(hasChildren(a)) ||
      (hasChildren(a) && hasChildren(b) ? (a.marriedOn || "9999").localeCompare(b.marriedOn || "9999") : 0) ||
      Number(b.status === "active") - Number(a.status === "active") ||
      (b.marriedOn || "").localeCompare(a.marriedOn || "") || a.id.localeCompare(b.id));
    const [primary, ...others] = unions;
    const additional = others.filter(union => {
      const id = union.a === person.id ? union.b : union.a;
      const partner = family.members.find(p => p.id === id);
      // People with their own ancestry or other partnerships remain in the tree.
      const anyChildren = family.members.some(child => child.parents.includes(id));
      return partner && !partner.parents.length && !partner.dynasty && !anyChildren && degree(id) === 1;
    });
    if (!additional.length) return [];
    const foldable = additional.map(union => union.a === person.id ? union.b : union.a);
    return [{ personId: person.id, primary, additional, foldable }];
  });
}

export function accordionFamily(family: Family, groups: PartnerGroup[], expanded: ReadonlySet<string>): Family {
  const hidden = new Map<string, string>();
  for (const group of groups) if (!expanded.has(group.personId))
    for (const id of group.foldable) hidden.set(id, group.personId);
  if (!hidden.size) return family;
  return {
    ...family,
    members: family.members.filter(p => !hidden.has(p.id)),
    unions: family.unions.filter(u => !hidden.has(u.a) && !hidden.has(u.b)),
  };
}

/** Reserve a local corridor outside the primary couple; storage stays unchanged. */
export function expandedPartnerPositions(family: Family, groups: PartnerGroup[], expanded: ReadonlySet<string>, saved: Record<string, Point>, mode: Layout): Record<string, Point> {
  const positions = Object.fromEntries(Object.entries(saved).map(([id, p]) => [id, { ...p }]));
  const active = groups.filter(group => expanded.has(group.personId));
  const folded = new Set(groups.flatMap(group => group.foldable));
  const occupied = Object.keys(positions).filter(id => !folded.has(id));
  const along = mode === "horizontal" ? "y" : "x";
  const cross = mode === "horizontal" ? "x" : "y";
  const gap = cardSeparation(mode);
  for (const group of active) {
    const origin = positions[group.personId];
    if (!origin) continue;
    const primaryId = group.primary.a === group.personId ? group.primary.b : group.primary.a;
    const primary = positions[primaryId];
    // Reserve a full generation band below the expanded stack. Moving the
    // following rows together preserves couples and descendant branch order.
    const lower = Object.keys(positions).filter(id =>
      !folded.has(id) && id !== group.personId && id !== primaryId &&
      positions[id][cross] > origin[cross] + gap[cross] / 2,
    );
    if (lower.length) {
      const boundary = Math.min(...lower.map(id => positions[id][cross]));
      const needed = origin[cross] + group.foldable.length * (gap[cross] + 0.01);
      const shift = Math.max(0, needed - boundary);
      if (shift > 0) {
        const shifted = new Set(lower);
        // A previously expanded column moves with its owner, never in pieces.
        for (const other of groups) if (shifted.has(other.personId))
          other.foldable.forEach(id => shifted.add(id));
        for (const id of shifted) positions[id][cross] += shift;
      }
    }
    const direction = primary && primary[along] > origin[along] ? -1 : 1;
    let column = origin[along] + direction * (gap[along] + 0.01);
    const target = (index: number): Point => ({ ...origin, [along]: column, [cross]: origin[cross] + index * (gap[cross] + 0.01) });
    if (primary) for (let i = 0; i < group.foldable.length; i++) {
      const kind = gapKind(family, group.foldable[i], primaryId);
      if (positionsOverlap(target(i), primary, mode, kind)) column = primary[along] + direction * (anchorSeparation(mode, kind)[along] + 0.01);
    }
    const reserved = group.foldable.map((id, i) => ({ id, point: target(i) }));
    // Push only obstructing neighbours outwards, preserving their couple blocks.
    const blockOf = (id: string) => {
      const block = new Set([id]);
      for (const member of block) for (const union of family.unions) {
        const other = union.a === member ? union.b : union.b === member ? union.a : undefined;
        if (other && other !== group.personId && other !== primaryId && occupied.includes(other) && positions[other]) block.add(other);
      }
      return block;
    };
    const push = (id: string, distance: number) => {
      const block = blockOf(id);
      for (const member of block) positions[member][along] += direction * distance;
      return [...block];
    };
    const queue: string[] = [];
    for (const slot of reserved) for (const other of occupied) {
      if (other === group.personId || other === primaryId) continue;
      const kind = gapKind(family, slot.id, other);
      if (!positionsOverlap(slot.point, positions[other], mode, kind)) continue;
      const edge = slot.point[along] + direction * (anchorSeparation(mode, kind)[along] + 0.01);
      queue.push(...push(other, Math.max(0, direction * (edge - positions[other][along]))));
    }
    while (queue.length) {
      const id = queue.shift()!;
      const ownBlock = blockOf(id);
      for (const other of occupied) {
        if (ownBlock.has(other) || other === group.personId || other === primaryId) continue;
        // Propagate only away from the expanded column, never back into it.
        if (direction * (positions[other][along] - positions[id][along]) < 0) continue;
        const kind = gapKind(family, id, other);
        if (!positionsOverlap(positions[id], positions[other], mode, kind)) continue;
        const distance = anchorSeparation(mode, kind)[along] + 0.01 - direction * (positions[other][along] - positions[id][along]);
        queue.push(...push(other, distance));
      }
    }
    group.foldable.forEach((id, i) => { positions[id] = target(i); occupied.push(id); });
  }
  return positions;
}
