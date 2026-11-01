import { type Layout, type Point } from "./types";
import { anchorSeparation, gapKind } from "./spacing";
import { generationRanks, arrangeMetrics } from "./generations";
import { holdDynastyWalls } from "./dynasties";
import { type Family } from "../domain";

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
  seat = new Map<string, number>(),
): Record<string, Point> {
  const ranks = generationRanks(family);
  const metrics = arrangeMetrics(mode, partnerSlots);
  const memberById = new Map(
    family.members.map((person) => [person.id, person]),
  );
  const earlier = (a: string, b: string) => {
    const left = seat.get(a);
    const right = seat.get(b);
    if (left !== undefined && right !== undefined && left !== right)
      return left - right;
    return memberById.get(a)!.name.localeCompare(memberById.get(b)!.name, "de");
  };
  const seen = new Set<string>();
  const households: { ids: string[]; rank: number }[] = [];
  const ordered = [...family.members].sort((a, b) => earlier(a.id, b.id));
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
            union.status === "separated" && (union.a === id || union.b === id),
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
    exclusiveChildren(household).sort((a, b) => earlier(a.ids[0], b.ids[0]));
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
      const seated = seat.has(a) && seat.has(b) && seat.get(a) !== seat.get(b);
      if (seated) return seat.get(a)! - seat.get(b)!;
      const center = (id: string) => {
        const parents = (memberById.get(id)?.parents ?? []).filter(
          (parent) => positions[parent],
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
      return (
        delta ||
        memberById.get(a)!.name.localeCompare(memberById.get(b)!.name, "de")
      );
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
    const keepChartOrder = ids.every((id) => seat.has(id));
    const row = !keepChartOrder && former.length && later.length ? former : ids;
    let cursor =
      left +
      Math.max(
        0,
        householdWidth({ ids: row }) < householdWidth({ ids })
          ? (householdWidth({ ids }) - householdWidth({ ids: row })) / 2
          : 0,
      );
    const rank = household.rank * (metrics.rank + metrics.rankGap);
    const nextRank = rank + metrics.rank + metrics.rankGap;
    for (const id of row) {
      const along = cursor - metrics.originAlong;
      positions[id] =
        mode === "horizontal" ? { x: rank, y: along } : { x: along, y: rank };
      cursor += memberWidth(id) + metrics.memberGap;
    }
    if (!keepChartOrder && later.length && former.length) {
      const first = former[0];
      const last = former[former.length - 1];
      const firstAlong =
        mode === "horizontal" ? positions[first].y : positions[first].x;
      const lastAlong =
        mode === "horizontal" ? positions[last].y : positions[last].x;
      later.forEach((id, index) => {
        const owner = family.unions.find(
          (union) =>
            union.status === "active" &&
            (union.a === id || union.b === id) &&
            former.includes(union.a === id ? union.b : union.a),
        );
        const mateId = owner ? (owner.a === id ? owner.b : owner.a) : first;
        const mateAlong =
          mode === "horizontal" ? positions[mateId].y : positions[mateId].x;
        const leftSide = mateAlong <= (firstAlong + lastAlong) / 2;
        const outer = leftSide
          ? mateAlong -
            metrics.along -
            metrics.memberGap -
            (needsSlot(id) ? metrics.slot : 0)
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
        positions[id] =
          mode === "horizontal"
            ? taken
              ? { x: nextRank, y: mateAlong }
              : { x: rank, y: along }
            : taken
              ? { x: mateAlong, y: nextRank }
              : { x: along, y: rank };
      });
    }
  };
  const placeTree = (
    household: { ids: string[]; rank: number },
    left: number,
    width: number,
  ) => {
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
  const roots = households.filter(
    (household) => parentIdsOf(household).length === 0,
  );
  const index = new Map(
    roots.map((household, position) => [household, position]),
  );
  const parent = roots.map((_, position) => position);
  const find = (position: number): number =>
    parent[position] === position
      ? position
      : (parent[position] = find(parent[position]));
  const unite = (a: number, b: number) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent[right] = left;
  };
  for (const household of households) {
    const hits = roots.filter((root) =>
      parentIdsOf(household).some((id) => contains(root, id)),
    );
    for (let i = 1; i < hits.length; i++)
      unite(index.get(hits[0])!, index.get(hits[i])!);
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
      earlier(a.ids[0], b.ids[0]),
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
          sharedWidths[position] +
          householdGap(household, shared[position + 1]);
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
    return (
      parents.reduce((sum, id) => sum + alongCenter(id), 0) / parents.length
    );
  };
  // A couple can belong to two branches at once, so neither branch claims it
  // while the trees are packed. Seat it directly beside the siblings already
  // on that row, and pull the other branch in to the same gap.
  const alongKey = mode === "horizontal" ? "y" : "x";
  const visualLeftOf = (id: string) =>
    positions[id][alongKey] + metrics.originAlong;
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
    const leftIds =
      splitAt > 0
        ? placedComponent(parents.slice(0, splitAt), blocked)
        : new Set<string>();
    const rightIds =
      splitAt > 0
        ? placedComponent(parents.slice(splitAt), blocked)
        : new Set<string>();
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
          (memberById.get(id)?.parents ?? []).some((parent) =>
            parents.has(parent),
          ),
      );
    };
    const partnerIn = (ids: Set<string>) =>
      household.ids.find((id) =>
        (memberById.get(id)?.parents ?? []).some((parent) => ids.has(parent)),
      );
    const leftSiblings = partnerIn(leftIds)
      ? siblingsOf(partnerIn(leftIds)!, leftIds)
      : [];
    const rightSiblings = partnerIn(rightIds)
      ? siblingsOf(partnerIn(rightIds)!, rightIds)
      : [];
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
      const siblingHouse = households.find((item) =>
        item.ids.includes(nearest),
      );
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
          if (
            !positions[birthId] ||
            !positions[inlawId] ||
            !sameRow(birthId, inlawId)
          )
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
      left = Math.max(
        left,
        ...Object.keys(positions).map((id) => visualRightOf(id)),
      );
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
      left = Math.max(
        left,
        ...Object.keys(positions).map((id) => visualRightOf(id)),
      );
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
      const minimum = anchorSeparation(mode, gapKind(family, previous, next))[
        alongKey
      ];
      const gap = positions[next][alongKey] - positions[previous][alongKey];
      if (gap >= minimum - 0.5) continue;
      const need = minimum - gap;
      for (const id of unionMates(family, next)) {
        if (!positions[id] || Math.abs(crossOf(id) - crossOf(next)) > 8)
          continue;
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
          household.ids.every((id) => !positions[id]) &&
          parentAnchor(household) !== null,
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
    open = open.filter((household) =>
      household.ids.some((id) => !positions[id]),
    );
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
