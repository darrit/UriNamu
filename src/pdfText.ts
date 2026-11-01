import { newPerson, normalize, unionKey, type Family, type Union } from "./domain";
import { validDate, definitelyBefore, dateBounds } from "./dates";

const PERSON_CAP = 500;
const particles = new Set([
  "von",
  "van",
  "de",
  "da",
  "di",
  "la",
  "le",
  "der",
  "den",
  "dem",
  "zu",
  "zur",
  "zum",
]);

type Draft = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  born: string;
  died: string;
  place: string;
  bio: string;
  parents: string[];
};

export function familyNameFromFile(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function parseGenericFamily(
  text: string,
  name: string,
): { family: Family | null; truncated: boolean } {
  const lines = normalizeLines(
    text.replace(/\u0000/g, " ").replace(/\r\n?/g, "\n").split("\n"),
  );
  const people: Draft[] = [];
  const unions: Union[] = [];
  const byName = new Map<string, Draft[]>();
  let focus: Draft | null = null;
  let truncated = false;
  const remember = (person: Draft) => {
    const key = nameKey(person.name);
    const list = byName.get(key) ?? [];
    list.push(person);
    byName.set(key, list);
  };
  const add = (person: Draft) => {
    if (people.length >= PERSON_CAP) {
      truncated = true;
      return null;
    }
    people.push(person);
    remember(person);
    focus = person;
    return person;
  };
  const find = (label: string) => {
    const hits = byName.get(nameKey(label)) ?? [];
    return hits.length === 1 ? hits[0] : undefined;
  };
  const ensure = (label: string) => {
    const found = find(label);
    if (found) return found;
    if ((byName.get(nameKey(label)) ?? []).length > 1) return undefined;
    const split = splitName(label);
    if (!split) return undefined;
    return add({
      id: crypto.randomUUID(),
      ...split,
      born: "",
      died: "",
      place: "",
      bio: "",
      parents: [],
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (skip(line)) continue;
    const parents = parentsOf(line);
    if (parents && focus) {
      const child: Draft = focus;
      const [left, right] = parents;
      const a = ensure(left);
      const b = ensure(right);
      if (
        a &&
        b &&
        a.id !== b.id &&
        a.id !== child.id &&
        b.id !== child.id &&
        !reaches(a, child, people) &&
        !reaches(b, child, people)
      )
        child.parents = [a.id, b.id];
      focus = child;
      continue;
    }
    const divorced = divorceOf(line);
    if (divorced && focus) {
      const other = ensure(divorced);
      if (other && other.id !== focus.id) link(unions, focus, other, undefined, true);
      continue;
    }
    const marriage = marriageOf(line);
    if (marriage) {
      const right = ensure(marriage.right);
      const left: Draft | undefined =
        (marriage.left ? ensure(marriage.left) : focus) ?? undefined;
      if (left && right && left.id !== right.id) {
        link(unions, left, right, marriage.date, false);
        focus = left;
      }
      continue;
    }
    const wedding = weddingOf(line);
    if (wedding && unions.length) {
      unions[unions.length - 1].marriedOn = wedding;
      continue;
    }
    const dated = datedPerson(line);
    if (dated) {
      absorb(add, find, dated);
      continue;
    }
    if (!isName(line)) continue;
    const following: string[] = [];
    while (index + 1 < lines.length && isDateLine(lines[index + 1]) && following.length < 4) {
      index += 1;
      following.push(lines[index]);
    }
    if (!following.length) continue;
    const datedBlock = datedPerson(`${line} ${following.join(" ")}`);
    if (datedBlock) absorb(add, find, datedBlock);
  }

  if (!people.length) return { family: null, truncated };
  for (const person of people) {
    if (definitelyBefore(person.died, person.born)) person.died = "";
    if (person.parents.length !== 2) continue;
    const elders = person.parents.map((id) => people.find((item) => item.id === id));
    if (elders.some((elder) => elder?.born && person.born && dateBounds(elder.born)[0] >= dateBounds(person.born)[1]))
      person.parents = [];
  }
  for (const union of unions) {
    if (!union.marriedOn) continue;
    const pair = [union.a, union.b].map((id) => people.find((item) => item.id === id));
    if (
      pair.some(
        (person) =>
          person &&
          (definitelyBefore(union.marriedOn!, person.born) ||
            definitelyBefore(person.died, union.marriedOn!)),
      )
    )
      delete union.marriedOn;
  }
  try {
    return {
      truncated,
      family: normalize({
        version: 2,
        name: name.trim().slice(0, 100) || "Familie",
        members: people.map((person) => ({
          ...newPerson(),
          id: person.id,
          name: person.name,
          firstName: person.firstName,
          lastName: person.lastName,
          born: person.born,
          died: person.died,
          place: person.place,
          bio: person.bio,
          parents: person.parents,
        })),
        unions,
      }),
    };
  } catch {
    return { family: null, truncated };
  }
}

function absorb(
  add: (person: Draft) => Draft | null,
  find: (label: string) => Draft | undefined,
  dated: ReturnType<typeof datedPerson>,
) {
  if (!dated) return;
  const existing = find(dated.name);
  if (existing && (existing.born === dated.born || !dated.born)) {
    if (!existing.died && dated.died) existing.died = dated.died;
    if (!existing.place && dated.place) existing.place = dated.place;
    if (!existing.bio && dated.bio) existing.bio = dated.bio;
    if (!existing.born && dated.born) existing.born = dated.born;
    return;
  }
  const split = splitName(dated.name);
  if (!split) return;
  add({
    id: crypto.randomUUID(),
    ...split,
    born: dated.born,
    died: dated.died,
    place: dated.place,
    bio: dated.bio,
    parents: [],
  });
}

function link(
  unions: Union[],
  left: Draft,
  right: Draft,
  date: string | undefined,
  divorced: boolean,
) {
  const id = unionKey(left.id, right.id);
  let union = unions.find((item) => item.id === id);
  if (!union) {
    union = {
      id,
      a: left.id,
      b: right.id,
      status: divorced ? "separated" : "active",
      ended: false,
      marriage: divorced ? "divorced" : "married",
    };
    unions.push(union);
  }
  if (divorced) {
    union.status = "separated";
    union.marriage = "divorced";
    delete union.marriedOn;
    return;
  }
  union.status = "active";
  union.marriage = "married";
  if (date) union.marriedOn = date;
}

function reaches(elder: Draft, child: Draft, people: Draft[]) {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (id === child.id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const person = people.find((item) => item.id === id);
    return person?.parents.some(walk) ?? false;
  };
  return walk(elder.id);
}

function normalizeLines(lines: string[]) {
  const compact: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || skip(line)) continue;
    const previous = compact.at(-1);
    if (
      previous &&
      previous.length + line.length < 80 &&
      tokenCount(previous) + tokenCount(line) <= 4 &&
      !(tokenCount(previous) >= 2 && tokenCount(line) >= 2) &&
      !/[†*]/.test(previous) &&
      !isDateLine(line) &&
      !parentsOf(line) &&
      !marriageOf(line)
    ) {
      compact[compact.length - 1] = `${previous} ${line}`;
      continue;
    }
    compact.push(line);
  }
  const out: string[] = [];
  for (let index = 0; index < compact.length; index += 1) {
    if (/^[†*+]$/.test(compact[index]) && compact[index + 1]) {
      out.push(`${compact[index]} ${compact[index + 1]}`);
      index += 1;
      continue;
    }
    out.push(compact[index]);
  }
  return out;
}

function tokenCount(value: string) {
  return value.trim().split(/\s+/).length;
}

function skip(line: string) {
  return (
    /^urinamu(?:\s+\d+\s*\/\s*\d+)?$/i.test(line) ||
    /^\d+\s*\/\s*\d+$/.test(line) ||
    /^(?:seite|page)\s+\d+$/i.test(line)
  );
}

function isDateLine(line: string) {
  return /^(?:geboren|geb\.?|\*|born|gestorben|gest\.?|†|\+|died)\b/iu.test(line);
}

function isName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 80 || /\d/.test(name)) return false;
  if (/^(?:urinamu|stammbaum|seite|page)$/i.test(name)) return false;
  return /^[\p{L}][\p{L}.'’\-]*(?:\s+[\p{L}][\p{L}.'’\-]*){0,5}$/u.test(name);
}

function splitName(full: string) {
  const cleaned = tidyName(full);
  if (!isName(cleaned) || cleaned.length > 100) return null;
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1)
    return { name: parts[0], firstName: parts[0], lastName: "" };
  let index = parts.length - 1;
  while (index > 1 && particles.has(parts[index - 1].toLocaleLowerCase())) index -= 1;
  const firstName = parts.slice(0, index).join(" ");
  const lastName = parts.slice(index).join(" ");
  return { name: `${firstName} ${lastName}`, firstName, lastName };
}

function tidyName(raw: string) {
  const parts = raw.split(",");
  if (parts.length === 2) {
    const swapped = `${parts[1].trim()} ${parts[0].trim()}`.replace(/\s+/g, " ");
    if (isName(swapped)) return swapped;
  }
  return raw.trim();
}

function nameKey(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

const DATE = "(\\d{1,2})[./](\\d{1,2})[./](\\d{4})|(\\d{4})-(\\d{2})-(\\d{2})";
const YEAR = "((?:1[5-9]|20)\\d{2})";

function datedPerson(line: string) {
  const birth = marked(line, "birth");
  const death = marked(line, "death");
  if (!birth && !death) return null;
  let rest = line;
  if (birth?.match) rest = rest.replace(birth.match, " ");
  if (death?.match) rest = rest.replace(death.match, " ");
  const placeMatch = rest.match(/\b(?:in|at)\s+([\p{L}][\p{L} .'\-]{1,40})/iu);
  const place = placeMatch?.[1].trim().replace(/[.,;]+$/g, "") ?? "";
  if (placeMatch) rest = rest.replace(placeMatch[0], " ");
  rest = rest.replace(/[(),;:]+/g, " ").replace(/\s+/g, " ").trim();
  const name = tidyName(rest);
  if (!isName(name)) return null;
  const notes = [
    !birth?.iso && birth?.year ? `* ${birth.year}` : "",
    !death?.iso && death?.year ? `† ${death.year}` : "",
  ].filter(Boolean);
  return {
    name,
    born: birth?.iso ?? "",
    died: death?.iso ?? "",
    place: place.length <= 80 ? place : "",
    bio: notes.join(" "),
  };
}

function marked(line: string, kind: "birth" | "death") {
  const marker = kind === "birth" ? "(?:\\*|geb(?:oren)?\\.?|born)" : "(?:†|\\+|gest(?:orben)?\\.?|died)";
  const match = new RegExp(
    `(?:^|[^\\p{L}])${marker}\\s*(${DATE}|${YEAR})`,
    "iu",
  ).exec(line);
  if (!match) return null;
  const token = match[1];
  const full = isoDate(token);
  const year = !full && /^\d{4}$/.test(token) ? token : "";
  return { match: match[0], iso: full ?? "", year };
}

function parentsOf(line: string): [string, string] | null {
  const match =
    line.match(
      /^(?:kind|tochter|sohn)\s+von\s*:?\s*(.+?)\s+(?:und|and)\s+(.+?)\.?$/iu,
    ) ||
    line.match(
      /^(?:child|daughter|son)\s+of\s*:?\s*(.+?)\s+and\s+(.+?)\.?$/iu,
    ) ||
    line.match(/^(?:eltern|parents)\s*:\s*(.+?)\s+(?:und|and)\s+(.+?)\.?$/iu);
  if (!match || !isName(tidyName(match[1])) || !isName(tidyName(match[2]))) return null;
  return [tidyName(match[1]), tidyName(match[2])];
}

function marriageOf(line: string) {
  const lone = line.match(
    /^(?:verheiratet mit|married to)\s+(.+?)(?:\s+(?:am|on)\s+(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2}))?\.?$/iu,
  );
  if (lone && isName(tidyName(lone[1])))
    return { right: tidyName(lone[1]), date: lone[2] ? isoDate(lone[2]) ?? undefined : undefined };
  const both = line.match(
    /^(.+?)\s+(?:verheiratet mit|married to)\s+(.+?)(?:\s+(?:am|on)\s+(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2}))?\.?$/iu,
  );
  if (both && isName(tidyName(both[1])) && isName(tidyName(both[2])))
    return {
      left: tidyName(both[1]),
      right: tidyName(both[2]),
      date: both[3] ? isoDate(both[3]) ?? undefined : undefined,
    };
  return null;
}

function divorceOf(line: string) {
  const match = line.match(/^(?:geschieden von|divorced from)\s+(.+?)\.?$/iu);
  return match && isName(tidyName(match[1])) ? tidyName(match[1]) : null;
}

function weddingOf(line: string) {
  const match = line.match(
    /^geheiratet(?:\s+am)?\s+(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})\.?$/iu,
  );
  return match ? isoDate(match[1]) : null;
}

function isoDate(value: string) {
  const dotted = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const iso = dotted
    ? `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`
    : value;
  return validDate(iso) ? iso : null;
}
