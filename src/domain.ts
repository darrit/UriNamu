import { t } from "./i18n";

export type Gender = "male" | "female" | "";
export interface Person {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthName?: string;
  born: string;
  died: string;
  place: string;
  bio: string;
  gender: Gender;
  appearance: "normal" | "dimmed" | "struck";
  photo: string;
  parents: string[];
  positions?: Partial<
    Record<"classic" | "horizontal" | "tapestry", { x: number; y: number }>
  >;
  partner?: string;
  /** Dynasty founded by this person. Descendants belong to it. */
  dynasty?: Dynasty;
  /** Founder ids of partner dynasties this person has joined. */
  dynastyWith?: string[];
}
export type Marriage = "unspecified" | "married" | "divorced";
export interface Union {
  id: string;
  a: string;
  b: string;
  status: "active" | "separated";
  ended: boolean;
  marriage?: Marriage;
  /** Wedding day, as YYYY-MM-DD. Absent when unknown. */
  marriedOn?: string;
  /** False hides the child plus without recording that there are no children. */
  childPrompt?: boolean;
  /**
   * Older files stored the dynasty on the couple. Loading moves it onto one
   * partner; the other partner joins that dynasty.
   */
  dynasty?: Dynasty;
}
export interface Dynasty {
  name: string;
  logo: string;
  corner: "left" | "right";
}
export interface Family {
  version: 2;
  name: string;
  members: Person[];
  unions: Union[];
}
export const newPerson = (): Person => ({
  id: crypto.randomUUID(),
  name: "",
  firstName: "",
  lastName: "",
  birthName: "",
  born: "",
  died: "",
  place: "",
  bio: "",
  gender: "",
  appearance: "normal",
  photo: "",
  parents: [],
});
export const unionKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * A connected partnership is a marriage. A line struck for divorce is
 * divorced. A separated pair that was never connected stays unspecified.
 */
export function assignMarriage(union: Union): void {
  if (union.status === "separated") {
    if (union.marriage === "married" || union.marriage === "divorced")
      union.marriage = "divorced";
    return;
  }
  union.marriage = "married";
}
export const childrenOf = (f: Family, u: Union) =>
  f.members.filter((p) => p.parents.includes(u.a) && p.parents.includes(u.b));

/** The founder, their descendants, people who joined, and descendants' current partners. */
export function dynastyMembers(family: Family, founder: Person): string[] {
  const blood = new Set<string>([
    founder.id,
    ...descendantIds(family, founder.id),
  ]);
  const region = new Set(blood);
  for (const person of family.members)
    if (person.dynastyWith?.includes(founder.id)) region.add(person.id);
  for (const link of family.unions) {
    if (link.status !== "active") continue;
    if (blood.has(link.a) && link.a !== founder.id) region.add(link.b);
    if (blood.has(link.b) && link.b !== founder.id) region.add(link.a);
  }
  return [...region];
}

/** The child control on a partnership line: plus, childless badge, or nothing. */
export function childBranchControl(
  family: Family,
  union: Union,
): "plus" | "ended" | "hidden" {
  if (union.marriage !== "married" || union.childPrompt === false) return "hidden";
  if (childrenOf(family, union).length) return "hidden";
  return union.ended ? "ended" : "plus";
}
function assertDynasty(dynasty: Dynasty): void {
  if (!dynasty || typeof dynasty !== "object") throw Error(t("errDynasty"));
  if (
    typeof dynasty.name !== "string" ||
    !dynasty.name.trim() ||
    dynasty.name.length > 80
  )
    throw Error(t("errDynastyName"));
  if (
    (dynasty.corner !== "left" && dynasty.corner !== "right") ||
    typeof dynasty.logo !== "string" ||
    (dynasty.logo &&
      !/^data:image\/(jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(
        dynasty.logo,
      ))
  )
    throw Error(t("errDynasty"));
}
export function validate(f: Family): void {
  if (
    !f ||
    f.version !== 2 ||
    typeof f.name !== "string" ||
    !f.name.trim() ||
    f.name.length > 100 ||
    !Array.isArray(f.members) ||
    f.members.length > 5000 ||
    !Array.isArray(f.unions)
  )
    throw Error(t("errInvalidFile"));
  const ids = new Set<string>();
  for (const p of f.members) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      p.id.includes("|") ||
      ids.has(p.id)
    )
      throw Error(t("errDuplicateId"));
    ids.add(p.id);
    if (
      p.positions !== undefined &&
      (!p.positions ||
        typeof p.positions !== "object" ||
        Array.isArray(p.positions) ||
        Object.entries(p.positions).some(
          ([mode, point]) =>
            !["classic", "horizontal", "tapestry"].includes(mode) ||
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y) ||
            Math.abs(point.x) > 1_000_000 ||
            Math.abs(point.y) > 1_000_000,
        ))
    )
      throw Error(t("errPosition"));
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 100)
      throw Error(t("errName"));
    for (const key of ["firstName", "lastName", "birthName"] as const)
      if (
        p[key] !== undefined &&
        (typeof p[key] !== "string" || p[key]!.length > 100)
      )
        throw Error(t("errNameFields"));
    for (const k of ["born", "died", "place", "bio", "photo"] as const)
      if (typeof p[k] !== "string") throw Error(t("errProfile"));
    if (
      !["male", "female", ""].includes(p.gender) ||
      !["normal", "dimmed", "struck"].includes(p.appearance)
    )
      throw Error(t("errAppearance"));
    if (
      !Array.isArray(p.parents) ||
      p.parents.length > 2 ||
      new Set(p.parents).size !== p.parents.length
    )
      throw Error(t("errTwoParents"));
    for (const date of [p.born, p.died])
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          new Date(date).toISOString().slice(0, 10) !== date)
      )
        throw Error(t("errDate"));
    if (p.born && p.died && p.died < p.born)
      throw Error(t("errDeathBeforeBirth"));
    if (
      p.photo &&
      !/^data:image\/(jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(p.photo)
    )
      throw Error(t("errPhoto"));
    if (p.dynasty !== undefined) assertDynasty(p.dynasty);
    if (p.dynastyWith !== undefined) {
      if (
        !Array.isArray(p.dynastyWith) ||
        new Set(p.dynastyWith).size !== p.dynastyWith.length ||
        p.dynastyWith.some((id) => typeof id !== "string" || !id || id === p.id)
      )
        throw Error(t("errDynasty"));
    }
  }
  const map = new Map(f.members.map((p) => [p.id, p]));
  for (const p of f.members)
    for (const id of p.parents) {
      if (!ids.has(id) || id === p.id) throw Error(t("errParent"));
      const parent = map.get(id)!;
      if (parent.born && p.born && parent.born >= p.born)
        throw Error(t("errParentBorn"));
    }
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw Error(t("errCycle"));
    if (done.has(id)) return;
    visiting.add(id);
    map.get(id)!.parents.forEach(visit);
    visiting.delete(id);
    done.add(id);
  };
  f.members.forEach((p) => visit(p.id));
  const keys = new Set<string>(),
    active = new Set<string>();
  for (const u of f.unions) {
    if (
      !ids.has(u.a) ||
      !ids.has(u.b) ||
      u.a === u.b ||
      u.id !== unionKey(u.a, u.b) ||
      keys.has(u.id) ||
      !["active", "separated"].includes(u.status) ||
      typeof u.ended !== "boolean" ||
      (u.childPrompt !== undefined && typeof u.childPrompt !== "boolean") ||
      !["unspecified", "married", "divorced"].includes(
        u.marriage === undefined ? "unspecified" : u.marriage,
      ) ||
      (u.marriage === "married" && u.status !== "active") ||
      (u.marriage === "divorced" && u.status !== "separated")
    )
      throw Error(t("errUnion"));
    if (u.marriedOn) {
      if (
        typeof u.marriedOn !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(u.marriedOn) ||
        new Date(u.marriedOn).toISOString().slice(0, 10) !== u.marriedOn
      )
        throw Error(t("errDate"));
      for (const id of [u.a, u.b]) {
        const partner = map.get(id);
        if (!partner) continue;
        if (
          (partner.born && u.marriedOn < partner.born) ||
          (partner.died && u.marriedOn > partner.died)
        )
          throw Error(t("errMarriageDate"));
      }
    }
    keys.add(u.id);
    if (u.status === "active") {
      if (active.has(u.a) || active.has(u.b))
        throw Error(t("errSeparateFirst"));
      active.add(u.a);
      active.add(u.b);
    }
    if (u.ended && childrenOf(f, u).length)
      throw Error(t("errChildless"));
  }
  for (const p of f.members) {
    for (const founderId of p.dynastyWith ?? []) {
      const founder = map.get(founderId);
      if (
        !founder?.dynasty ||
        !f.unions.some(
          (u) =>
            (u.a === p.id && u.b === founderId) ||
            (u.b === p.id && u.a === founderId),
        )
      )
        throw Error(t("errDynasty"));
    }
  }
  for (const p of f.members)
    if (
      p.parents.length === 2 &&
      !keys.has(unionKey(...(p.parents as [string, string])))
    )
      throw Error(t("errParentsUnion"));
}
export function normalize(raw: unknown): Family {
  const r = raw as {
    version?: number;
    name?: string;
    members: Person[];
    unions?: Union[];
    relationships?: Record<string, Omit<Union, "id">>;
  };
  if (!r || !Array.isArray(r.members)) throw Error(t("errNoFamily"));
  const f: Family = {
    version: 2,
    name: r.name || "Familie Morgenstern",
    members: r.members.map((p) => ({
      ...newPerson(),
      ...p,
      gender: ["male", "female"].includes(p.gender) ? p.gender : "",
      appearance: p.appearance || "normal",
      photo: p.photo || "",
      parents: p.parents || [],
      partner: undefined,
    })),
    unions:
      r.unions ||
      Object.entries(r.relationships || {}).map(([id, u]) => ({ ...u, id })),
  };
  if (!r.unions && !r.relationships)
    for (const p of r.members) {
      if (
        p.partner &&
        !f.unions.some((u) => u.id === unionKey(p.id, p.partner!))
      )
        f.unions.push({
          id: unionKey(p.id, p.partner),
          a: p.id,
          b: p.partner,
          status: "active",
          ended: false,
          marriage: "unspecified",
        });
    }
  for (const p of f.members)
    if (p.parents.length === 2) {
      const [a, b] = p.parents;
      if (!f.unions.some((u) => u.id === unionKey(a, b)))
        f.unions.push({
          id: unionKey(a, b),
          a,
          b,
          status: "separated",
          ended: false,
          marriage: "unspecified",
        });
    }
  f.unions.forEach(assignMarriage);
  for (const union of f.unions)
    if (typeof union.marriedOn !== "string" || !union.marriedOn.trim())
      delete union.marriedOn;
  for (const union of f.unions) {
    if (!union.dynasty) continue;
    const a = f.members.find((p) => p.id === union.a);
    const b = f.members.find((p) => p.id === union.b);
    const host = a && !a.dynasty ? a : b && !b.dynasty ? b : a;
    const guest = host && a && host.id === a.id ? b : a;
    if (host && !host.dynasty) host.dynasty = union.dynasty;
    if (host && guest) {
      const joined = new Set(guest.dynastyWith ?? []);
      joined.add(host.id);
      guest.dynastyWith = [...joined];
    }
    delete union.dynasty;
  }
  validate(f);
  return f;
}
export function updatePerson(f: Family, p: Person, partner: string): Family {
  const person = storedPersonName(p);
  const next = structuredClone(f);
  const i = next.members.findIndex((x) => x.id === person.id);
  if (i < 0) next.members.push(person);
  else {
    person.dynasty = next.members[i].dynasty;
    person.dynastyWith = next.members[i].dynastyWith;
    next.members[i] = person;
  }
  const current = next.unions.find(
    (u) => u.status === "active" && (u.a === p.id || u.b === p.id),
  );
  if (current && ![current.a, current.b].includes(partner)) {
    current.status = "separated";
    if (current.marriage === "married") current.marriage = "divorced";
  }
  if (partner) {
    const key = unionKey(p.id, partner),
      existing = next.unions.find((u) => u.id === key);
    if (existing) existing.status = "active";
    else
      next.unions.push({
        id: key,
        a: p.id,
        b: partner,
        status: "active",
        ended: false,
        marriage: "unspecified",
      });
  }
  for (const member of next.members)
    if (member.parents.length === 2) {
      const [a, b] = member.parents,
        key = unionKey(a, b);
      if (!next.unions.some((u) => u.id === key))
        next.unions.push({
          id: key,
          a,
          b,
          status: "separated",
          ended: false,
          marriage: "unspecified",
        });
    }
  next.unions.forEach(assignMarriage);
  next.unions.forEach((u) => {
    if (childrenOf(next, u).length) u.ended = false;
  });
  validate(next);
  return next;
}
export function descendantIds(f: Family, id: string): string[] {
  const found = new Set<string>();
  const visit = (parentId: string) => {
    for (const person of f.members) {
      if (!person.parents.includes(parentId) || found.has(person.id)) continue;
      found.add(person.id);
      visit(person.id);
    }
  };
  visit(id);
  return [...found];
}
export function removePerson(
  f: Family,
  id: string,
  withDescendants = false,
): Family {
  const ids = new Set([id]);
  if (withDescendants) for (const child of descendantIds(f, id)) ids.add(child);
  const next = structuredClone(f);
  next.members = next.members.filter((p) => !ids.has(p.id));
  next.members.forEach((p) => {
    p.parents = p.parents.filter((x) => !ids.has(x));
    if (!p.dynastyWith) return;
    p.dynastyWith = p.dynastyWith.filter((x) => !ids.has(x));
    if (!p.dynastyWith.length) delete p.dynastyWith;
  });
  next.unions = next.unions.filter((u) => !ids.has(u.a) && !ids.has(u.b));
  validate(next);
  return next;
}
export function setDeathDate(f: Family, id: string, died: string): Family {
  const next = structuredClone(f);
  const person = next.members.find((p) => p.id === id);
  if (!person)
    throw Error(t("errMissingPerson"));
  person.died = died;
  validate(next);
  return next;
}
export const symbol = (p: Person) =>
  p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : "";
export const years = (p: Person) =>
  [
    p.born ? dateLabel(p.born) : t("birthOpen"),
    p.died ? `† ${dateLabel(p.died)}` : "",
  ]
    .filter(Boolean)
    .join(" – ");

export function nameParts(p: Pick<Person, "name" | "firstName" | "lastName">) {
  if (p.firstName?.trim() || p.lastName?.trim())
    return {
      firstName: p.firstName?.trim() || "",
      lastName: p.lastName?.trim() || "",
    };
  const parts = p.name.trim().split(/\s+/);
  return parts.length > 1
    ? { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! }
    : { firstName: p.name.trim(), lastName: "" };
}
/** Values for the given-name and surname inputs. Keeps spaces typed between names. */
export function nameInputs(p: Pick<Person, "name" | "firstName" | "lastName">) {
  const parts = nameParts(p);
  const keep = (stored: string | undefined, shown: string) =>
    typeof stored === "string" && stored.trim() === shown ? stored : shown;
  return {
    firstName: keep(p.firstName, parts.firstName),
    lastName: keep(p.lastName, parts.lastName),
  };
}
function storedPersonName<T extends Person>(p: T): T {
  const firstName = p.firstName?.trim();
  const lastName = p.lastName?.trim();
  if (!firstName && !lastName)
    return {
      ...p,
      ...(p.firstName !== undefined ? { firstName: "" } : {}),
      ...(p.lastName !== undefined ? { lastName: "" } : {}),
    };
  return {
    ...p,
    ...(p.firstName !== undefined ? { firstName } : {}),
    ...(p.lastName !== undefined ? { lastName } : {}),
    name: [firstName ?? "", lastName ?? ""].filter(Boolean).join(" "),
  };
}
export function displayName(p: Person | undefined): string {
  if (!p) return "";
  if (!p.birthName?.trim()) return p.name;
  const parts = nameParts(p);
  return [parts.firstName, `(${p.birthName.trim()})`, parts.lastName]
    .filter(Boolean)
    .join(" ");
}

export function matchesQuery(person: Person, query: string) {
  const q = query.trim().toLocaleLowerCase();
  return !q || displayName(person).toLocaleLowerCase().includes(q);
}
import { dateLabel } from "./dates";
