import {
  type Family,
  type Person,
  type Union,
  validate,
  unionKey,
  assignMarriage,
  childrenOf,
  nameParts,
  displayName,
} from "./domain";
import { tidyLayout, type Layout } from "./layout";
import { t, type MessageKey } from "./i18n";
export const PROFILE_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "birthName",
  "born",
  "died",
  "place",
  "bio",
  "gender",
  "photo",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export interface MergeOptions {
  leftUnion: string;
  rightUnion: string;
  swap: boolean;
  name: string;
  marriage: "married" | "divorced" | "";
  parentPolicy: "combine" | "left" | "right";
  relationshipPolicy: "reject" | "left" | "right";
  matches: Record<string, string>;
  /** Right-hand people the user wants to keep even when the name would match. */
  keepSeparate?: string[];
  /** Per person and field, which side wins when both values differ. */
  fieldChoices?: Record<string, Partial<Record<ProfileField, "left" | "right">>>;
}
export interface ProfileConflict {
  leftId: string;
  rightId: string;
  field: ProfileField;
  leftValue: string;
  rightValue: string;
}
const FIELD_KEY: Record<ProfileField, MessageKey> = {
  name: "fieldName",
  firstName: "fieldFirstName",
  lastName: "fieldLastName",
  birthName: "fieldBirthName",
  born: "fieldBorn",
  died: "fieldDied",
  place: "fieldPlace",
  bio: "fieldBio",
  gender: "fieldGender",
  photo: "fieldPhoto",
};
export const profileFieldLabel = (field: ProfileField) => t(FIELD_KEY[field]);
export const eligibleUnions = (f: Family) =>
  f.unions.filter((u) => u.marriage === "married" || u.marriage === "divorced");
export function mergeFamilies(
  left: Family,
  right: Family,
  o: MergeOptions,
): Family {
  validate(left);
  validate(right);
  const lu = eligibleUnions(left).find((u) => u.id === o.leftUnion),
    ru = eligibleUnions(right).find((u) => u.id === o.rightUnion);
  if (!lu || !ru)
    throw Error(t("errChooseUnion"));
  if (!["married", "divorced"].includes(o.marriage))
    throw Error(t("errConfirmMarriage"));
  if (!o.name.trim()) throw Error(t("errNameTree"));
  const mappings = personMapping(left, right, lu, ru, o);
  const leftIds = new Set(left.members.map((p) => p.id));
  const translated = new Map<string, string>();
  for (const p of right.members) {
    let id = mappings.get(p.id);
    if (!id) {
      do {
        id = crypto.randomUUID();
      } while (leftIds.has(id) || [...translated.values()].includes(id));
    }
    translated.set(p.id, id);
  }
  const members = structuredClone(left.members);
  const mappedRight = right.members.map((p) => ({
    ...structuredClone(p),
    id: translated.get(p.id)!,
    parents: p.parents.map((id) => translated.get(id)!),
  }));
  for (const incoming of mappedRight) {
    const index = members.findIndex((p) => p.id === incoming.id);
    if (index < 0) {
      members.push(incoming);
      continue;
    }
    const original = members[index];
    const parents = resolvedParents(
      original.parents,
      incoming.parents,
      o.parentPolicy,
      original.name || incoming.name,
    );
    members[index] = {
      ...mergeProfile(original, incoming, o.fieldChoices?.[original.id]),
      id: original.id,
      parents,
    };
  }
  const unions = structuredClone(left.unions);
  const rightUnions = right.unions.map((u) => ({
    ...structuredClone(u),
    a: translated.get(u.a)!,
    b: translated.get(u.b)!,
  }));
  for (const incoming of rightUnions) {
    incoming.id = unionKey(incoming.a, incoming.b);
    const index = unions.findIndex((u) => u.id === incoming.id);
    if (index < 0) {
      unions.push(incoming);
      continue;
    }
    const original = unions[index];
    if (incoming.id === lu.id) {
      const marriedOn = original.marriedOn || incoming.marriedOn;
      unions[index] = {
        ...original,
        marriage: o.marriage as "married" | "divorced",
        status: o.marriage === "married" ? "active" : "separated",
        ended: original.ended && incoming.ended,
        ...(marriedOn ? { marriedOn } : {}),
      };
      if (!marriedOn) delete unions[index].marriedOn;
      continue;
    }
    const conflict =
      original.status !== incoming.status ||
      (original.marriage || "unspecified") !==
        (incoming.marriage || "unspecified");
    if (conflict && o.relationshipPolicy === "reject")
      throw Error(t("errOtherUnions"));
    const chosen = o.relationshipPolicy === "right" ? incoming : original;
    unions[index] = { ...chosen, ended: original.ended && incoming.ended };
  }
  const merged: Family = { version: 2, name: o.name.trim(), members, unions };
  // Combining complementary parent records can reveal an additional historical union.
  for (const p of members)
    if (
      p.parents.length === 2 &&
      !unions.some((u) => u.id === unionKey(p.parents[0], p.parents[1]))
    )
      unions.push({
        id: unionKey(p.parents[0], p.parents[1]),
        a: p.parents[0],
        b: p.parents[1],
        status: "separated",
        marriage: "unspecified",
        ended: false,
      });
  unions.forEach((u) => {
    if (childrenOf(merged, u).length) u.ended = false;
  });
  unions.forEach(assignMarriage);
  try {
    validate(merged);
  } catch (e) {
    throw Error(
      t("errMergeFailed", {
        detail: e instanceof Error ? e.message : String(e),
      }),
    );
  }
  for (const person of merged.members) delete person.positions;
  let arranged = merged;
  for (const mode of ["classic", "horizontal", "tapestry"] as Layout[])
    arranged = tidyLayout(arranged, mode, true);
  return arranged;
}

const textOf = (person: Person, field: ProfileField) =>
  String(person[field] ?? "").trim();
function sameIdentity(a: Person, b: Person) {
  const left = nameParts(a),
    right = nameParts(b);
  const key = (first: string, last: string) =>
    `${first} ${last}`.trim().toLocaleLowerCase("de").replace(/\s+/g, " ");
  const ak = key(left.firstName, left.lastName),
    bk = key(right.firstName, right.lastName);
  return Boolean(ak) && ak === bk;
}
function partnersOf(family: Family, id: string) {
  return family.unions
    .filter((u) => u.a === id || u.b === id)
    .map((u) => (u.a === id ? u.b : u.a));
}
/** True when the names settle which person is which, regardless of pair order. */
export function coupleAlignment(
  left: Family,
  right: Family,
  leftUnion: string,
  rightUnion: string,
): boolean | null {
  const lu = left.unions.find((u) => u.id === leftUnion),
    ru = right.unions.find((u) => u.id === rightUnion);
  if (!lu || !ru) return null;
  const la = left.members.find((p) => p.id === lu.a),
    lb = left.members.find((p) => p.id === lu.b),
    ra = right.members.find((p) => p.id === ru.a),
    rb = right.members.find((p) => p.id === ru.b);
  if (!la || !lb || !ra || !rb) return null;
  const aToA = sameIdentity(la, ra),
    aToB = sameIdentity(la, rb),
    bToA = sameIdentity(lb, ra),
    bToB = sameIdentity(lb, rb);
  if (aToB && bToA && !(aToA && bToB)) return true;
  if (aToA && bToB && !(aToB && bToA)) return false;
  if (aToB && !aToA && !bToB) return true;
  if (aToA && !aToB && !bToA) return false;
  if (bToA && !bToB && !aToA) return true;
  if (bToB && !bToA && !aToB) return false;
  return null;
}
function personMapping(
  left: Family,
  right: Family,
  lu: Union,
  ru: Union,
  o: MergeOptions,
) {
  const swap = coupleAlignment(left, right, lu.id, ru.id) ?? o.swap;
  const mappings = new Map<string, string>(
    Object.entries(o.matches).filter(([, value]) => value),
  );
  const anchors: [string, string][] = swap
    ? [
        [ru.a, lu.b],
        [ru.b, lu.a],
      ]
    : [
        [ru.a, lu.a],
        [ru.b, lu.b],
      ];
  for (const [from, to] of anchors) {
    if (mappings.has(from) && mappings.get(from) !== to)
      throw Error(t("errCoupleMap"));
    mappings.set(from, to);
  }
  const separate = new Set(o.keepSeparate || []);
  let grew = true;
  while (grew) {
    grew = false;
    const used = new Set(mappings.values());
    for (const person of right.members) {
      if (mappings.has(person.id) || separate.has(person.id)) continue;
      const candidates = left.members.filter(
        (other) =>
          !used.has(other.id) &&
          sameIdentity(person, other) &&
          related(person, other, mappings, left, right),
      );
      if (candidates.length !== 1) continue;
      mappings.set(person.id, candidates[0].id);
      used.add(candidates[0].id);
      grew = true;
    }
  }
  const leftIds = new Set(left.members.map((p) => p.id)),
    rightIds = new Set(right.members.map((p) => p.id)),
    used = new Set<string>();
  for (const [from, to] of mappings) {
    if (!rightIds.has(from) || !leftIds.has(to) || used.has(to))
      throw Error(t("errOnePerson"));
    used.add(to);
  }
  return mappings;
}
function related(
  rightPerson: Person,
  leftPerson: Person,
  mapped: Map<string, string>,
  left: Family,
  right: Family,
) {
  const rightPartners = partnersOf(right, rightPerson.id)
    .map((id) => mapped.get(id))
    .filter((id): id is string => Boolean(id));
  if (
    rightPartners.some((id) => partnersOf(left, leftPerson.id).includes(id))
  )
    return true;
  if (
    rightPerson.parents.length &&
    rightPerson.parents.every((id) => mapped.has(id))
  ) {
    const incoming = rightPerson.parents.map((id) => mapped.get(id)!).sort();
    const current = [...leftPerson.parents].sort();
    if (incoming.join("\0") === current.join("\0")) return true;
  }
  const rightChildren = right.members
    .filter((p) => p.parents.includes(rightPerson.id) && mapped.has(p.id))
    .map((p) => mapped.get(p.id)!);
  return left.members.some(
    (p) =>
      p.parents.includes(leftPerson.id) && rightChildren.includes(p.id),
  );
}
/** People beyond the chosen couple who match by name and partner, parent or child. */
export function matchedRelatives(
  left: Family,
  right: Family,
  o: MergeOptions,
) {
  const lu = left.unions.find((u) => u.id === o.leftUnion),
    ru = right.unions.find((u) => u.id === o.rightUnion);
  if (!lu || !ru) return {} as Record<string, string>;
  const mappings = personMapping(left, right, lu, ru, o);
  const relatives: Record<string, string> = {};
  for (const [from, to] of mappings)
    if (from !== ru.a && from !== ru.b) relatives[from] = to;
  return relatives;
}
export function profileConflicts(
  left: Family,
  right: Family,
  o: MergeOptions,
): ProfileConflict[] {
  const lu = eligibleUnions(left).find((u) => u.id === o.leftUnion),
    ru = eligibleUnions(right).find((u) => u.id === o.rightUnion);
  if (!lu || !ru) return [];
  const mappings = personMapping(left, right, lu, ru, o);
  const conflicts: ProfileConflict[] = [];
  for (const person of right.members) {
    const leftId = mappings.get(person.id);
    if (!leftId) continue;
    const original = left.members.find((p) => p.id === leftId);
    if (!original) continue;
    for (const field of PROFILE_FIELDS) {
      const leftValue = textOf(original, field),
        rightValue = textOf(person, field);
      if (leftValue && rightValue && leftValue !== rightValue)
        conflicts.push({
          leftId,
          rightId: person.id,
          field,
          leftValue,
          rightValue,
        });
    }
  }
  return conflicts;
}
function mergeProfile(
  original: Person,
  incoming: Person,
  choices: Partial<Record<ProfileField, "left" | "right">> | undefined,
) {
  const merged = structuredClone(original);
  for (const field of PROFILE_FIELDS) {
    const leftValue = textOf(original, field),
      rightValue = textOf(incoming, field);
    if (!leftValue && rightValue) {
      Object.assign(merged, { [field]: incoming[field] });
      continue;
    }
    if (!leftValue || !rightValue || leftValue === rightValue) continue;
    const choice = choices?.[field];
    if (choice === "right") Object.assign(merged, { [field]: incoming[field] });
    else if (choice !== "left")
      throw Error(
        t("errFieldConflict", {
          name: displayName(original) || displayName(incoming),
          field: profileFieldLabel(field),
        }),
      );
  }
  return merged;
}
/** Keep every known parent link. A chosen tree wins only when both sides name different parents. */
function resolvedParents(
  left: string[],
  right: string[],
  policy: MergeOptions["parentPolicy"],
  name: string,
) {
  if (!left.length) return [...right];
  if (!right.length) return [...left];
  const combined = [...new Set([...left, ...right])];
  if (combined.length <= 2) return combined;
  if (policy === "left") return [...left];
  if (policy === "right") return [...right];
  throw Error(t("errTooManyParents", { name }));
}
