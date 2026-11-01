import { type Family, type Union } from "./domain";

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
    unions.sort((a, b) => Number(b.status === "active") - Number(a.status === "active") ||
      (b.marriedOn || "").localeCompare(a.marriedOn || "") || a.id.localeCompare(b.id));
    const [primary, ...additional] = unions;
    const foldable = additional.flatMap(union => {
      const id = union.a === person.id ? union.b : union.a;
      const partner = family.members.find(p => p.id === id);
      // People with their own ancestry or other partnerships remain in the tree.
      const ownChildren = family.members.some(child => child.parents.includes(id) && !child.parents.includes(person.id));
      return partner && !partner.parents.length && !partner.dynasty && !ownChildren && degree(id) === 1 ? [id] : [];
    });
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
    members: family.members.filter(p => !hidden.has(p.id)).map(p => ({
      ...p,
      // Shared children stay visible, connected to the visible parent.
      parents: [...new Set(p.parents.map(id => hidden.get(id) ?? id))],
    })),
    unions: family.unions.filter(u => !hidden.has(u.a) && !hidden.has(u.b)),
  };
}
