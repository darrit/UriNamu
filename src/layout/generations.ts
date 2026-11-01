import { type Layout } from "./types";
import { type Family } from "../domain";

export function generationRanks(f: Family): Record<string, number> {
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
  // A partner who is also a descendant keeps pushing the same few people
  // downward on every pass. The distinct levels are the real generations.
  const order = [...new Set(Object.values(ranks))].sort((a, b) => a - b);
  const dense = new Map(order.map((rank, index) => [rank, index]));
  for (const id of Object.keys(ranks)) ranks[id] = dense.get(ranks[id])!;
  return ranks;
}

export function arrangeMetrics(mode: Layout, partnerSlots: boolean) {
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
  if (mode === "chart")
    return {
      along: 168,
      rank: 108,
      slot: partnerSlots ? 56 : 0,
      memberGap: 48,
      groupGap: 72,
      pairGap: 96,
      rankGap: 86,
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
