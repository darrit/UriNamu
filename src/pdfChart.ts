import { newPerson, normalize, unionKey, type Family, type Union } from "./domain";

export type ChartItem = { x: number; y: number; text: string };

type Card = {
  x: number;
  y: number;
  given: string;
  surname: string;
  birthName: string;
  marriageNames: string[];
  born: string;
  died: string;
  deceased: boolean;
  notes: string[];
  id: string;
  parents: string[];
};

type MarkerKind = "marriage" | "divorce" | "minus" | "equals";
type Marker = { x: number; kind: MarkerKind; date?: string; note?: string };
type Group = { people: Card[]; marker?: Marker };
export type ChartLine = { x1: number; y1: number; x2: number; y2: number };

const ROW_GAP = 90;
const GENERATION_GAP = 400;
const COUPLE_GAP = 2500;

export function parseChart(items: ChartItem[], fallbackName: string, lines: ChartLine[] = [], inferParents = true): Family | null {
  const merged = mergeGlyphs(items);
  const title = merged.find((item) => /^Tafel\b/i.test(item.text.trim()));
  const rows = clusterRows(
    items.filter((item) => item.text.trim() && !/^Tafel\b/i.test(item.text.trim())),
  );
  const generations = clusterGenerations(rows)
    .map(readGeneration)
    .filter((generation) => generation.cards.length);
  if (generations.length < 1 || generations.every((generation) => !generation.markers.length && generation.cards.length < 2))
    return null;
  const groups = generations.map((generation) => pairGroups(generation.cards, generation.markers));
  for (let index = 0; inferParents && index < groups.length - 1; index += 1)
    assignChildren(groups[index], groups[index + 1], lines);
  const cards = [...new Map(groups.flat().flatMap((group) => group.people).map((card) => [card.id, card])).values()];
  if (cards.length < 2) return null;
  const levels = [...new Set(cards.map((card) => card.y))].sort((a, b) => b - a);
  const rankOf = new Map(levels.map((y, index) => [y, index]));
  const alongOf = new Map<string, number>();
  for (const y of levels) {
    cards
      .filter((card) => card.y === y)
      .sort((a, b) => a.x - b.x)
      .forEach((card, index) => alongOf.set(card.id, index));
  }
  const chartAt = placeChart(cards);
  const unions = chooseUnions(groups.flat());
  try {
    return normalize({
      version: 2,
      name: (title?.text.replace(/^Tafel\s+/i, "").trim() || fallbackName).slice(0, 100) || "Familie",
      members: cards.map((card) => ({
        ...newPerson(),
        id: card.id,
        name: [card.given, card.surname].filter(Boolean).join(" "),
        firstName: card.given,
        lastName: card.surname,
        birthName: card.birthName || undefined,
        marriageNames: card.marriageNames.length ? card.marriageNames : undefined,
        born: card.born,
        died: card.died,
        deceased: card.deceased && !card.died ? true : undefined,
        bio: card.notes.join(" "),
        parents: card.parents,
        positions: {
          classic: { x: (alongOf.get(card.id) ?? 0) * 280, y: (rankOf.get(card.y) ?? 0) * 250 },
          horizontal: { x: (rankOf.get(card.y) ?? 0) * 340, y: (alongOf.get(card.id) ?? 0) * 220 },
          tapestry: { x: (alongOf.get(card.id) ?? 0) * 300, y: (rankOf.get(card.y) ?? 0) * 240 },
          chart: chartAt.get(card.id) ?? { x: 0, y: 0 },
        },
      })),
      unions,
    });
  } catch {
    return null;
  }
}

function mergeGlyphs(items: ChartItem[]) {
  const sorted = items
    .map((item) => ({ ...item, text: item.text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim() }))
    .filter((item) => item.text)
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const merged: ChartItem[] = [];
  for (const item of sorted) {
    const previous = merged.at(-1);
    const mark = /^[-–—]+$|^=+$/;
    if (
      previous &&
      !mark.test(previous.text) &&
      !mark.test(item.text) &&
      Math.abs(previous.y - item.y) < 20 &&
      item.x >= previous.x &&
      item.x - previous.x < 700
    ) {
      previous.text += `${item.x - previous.x > 280 ? " " : ""}${item.text}`;
      continue;
    }
    merged.push({ ...item });
  }
  return merged;
}

function clusterRows(items: ChartItem[]) {
  const sorted = items
    .map((item) => ({ ...item, text: item.text.replace(/\s+/g, " ").trim() }))
    .filter((item) => item.text)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: ChartItem[][] = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    if (!row || row[0].y - item.y > ROW_GAP) rows.push([item]);
    else row.push(item);
  }
  return rows.map((row) => row.sort((left, right) => left.x - right.x));
}

function clusterGenerations(rows: ChartItem[][]) {
  const generations: ChartItem[][][] = [];
  for (const row of rows) {
    const current = generations.at(-1);
    const previous = current?.at(-1)?.[0];
    if (!current || (previous && previous.y - row[0].y > GENERATION_GAP)) generations.push([row]);
    else current.push(row);
  }
  return generations;
}

function readGeneration(rows: ChartItem[][]) {
  const cards: Card[] = [];
  const markers: Marker[] = [];
  const nameRows = rows.filter((row) => row.some((item) => kindOf(item.text) === "name"));
  const given = nameRows[0] ?? [];
  const surnames = nameRows[1] ?? [];
  for (const item of given.filter((item) => kindOf(item.text) === "name")) {
    const surname = nearestText(surnames.filter((item) => kindOf(item.text) === "name"), item.x);
    const given = cleanName(item.text);
    const familyName = surname ? cleanName(surname.text) : "";
    const names = splitSurname(given === "..." && familyName === "..." ? "" : familyName);
    cards.push({
      x: item.x,
      y: item.y,
      given,
      surname: names.lastName,
      birthName: names.birthName,
      marriageNames: names.marriageNames,
      born: "",
      died: "",
      deceased: false,
      notes: [],
      id: crypto.randomUUID(),
      parents: [],
    });
  }
  for (const row of rows) {
    for (const item of row) {
      const kind = kindOf(item.text);
      if (kind === "birth" || kind === "death") {
        const card = nearestCard(cards, item.x);
        const date = readDate(item.text.replace(/^[+*]\s*/, ""));
        if (!card) continue;
        if (kind === "death") card.deceased = true;
        if (date.iso) card[kind === "birth" ? "born" : "died"] = date.iso;
        else if (date.note) card.notes.push(`${kind === "birth" ? "*" : "+"} ${date.note}`);
      } else if (kind === "marriage" || kind === "divorce" || kind === "minus" || kind === "equals") {
        const body = item.text.replace(/^(?:oo|o\|o|-+|=+)\s*/i, "");
        const date = readDate(body.replace(/^LAG\b\s*/i, ""));
        markers.push({
          x: item.x,
          kind,
          date: date.iso,
          note: !date.iso && date.note ? item.text.trim() : undefined,
        });
      }
    }
  }
  for (const card of cards) if (card.notes.length) card.notes = [...new Set(card.notes)];
  return { cards: cards.filter((card) => card.given || card.surname), markers };
}

function splitSurname(raw: string) {
  const parts = raw
    .split("/")
    .map((part) => cleanName(part))
    .filter((part) => part && part !== "...");
  if (parts.length <= 1)
    return { birthName: "", lastName: parts[0] ?? "", marriageNames: [] as string[] };
  return {
    birthName: parts[0],
    lastName: parts[parts.length - 1],
    marriageNames: parts.slice(1),
  };
}

/** Keep the chart's left-to-right gaps, but never so wide that the row leaves the screen. */
function placeChart(cards: Card[]) {
  const levels = [...new Set(cards.map((card) => card.y))].sort((a, b) => b - a);
  const point = new Map<string, { x: number; y: number }>();
  const minStep = 210;
  const maxStep = 460;
  levels.forEach((y, rank) => {
    const row = cards.filter((card) => card.y === y).sort((a, b) => a.x - b.x);
    const gaps = row.slice(1).map((card, index) => card.x - row[index].x).filter((gap) => gap > 0);
    const typical = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 1000;
    const scale = minStep / Math.max(typical, 1);
    let cursor = 0;
    row.forEach((card, index) => {
      if (index > 0) {
        const scaled = (card.x - row[index - 1].x) * scale;
        cursor += Math.max(minStep, Math.min(maxStep, scaled));
      }
      point.set(card.id, { x: cursor, y: rank * 230 });
    });
  });
  return point;
}

function pairGroups(cards: Card[], markers: Marker[]): Group[] {
  const sorted = [...cards].sort((left, right) => left.x - right.x);
  const used = new Set<string>();
  const groups: Group[] = [];
  for (const marker of [...markers].sort((left, right) => left.x - right.x)) {
    let best: { left: Card; right: Card; gap: number } | undefined;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      const gap = right.x - left.x;
      const key = `${left.id}|${right.id}|${marker.kind}`;
      if (left.x < marker.x && marker.x < right.x && gap < COUPLE_GAP && !used.has(key) && (!best || gap < best.gap))
        best = { left, right, gap };
    }
    if (!best) continue;
    used.add(`${best.left.id}|${best.right.id}|${marker.kind}`);
    if (marker.note) {
      best.left.notes.push(marker.note);
      best.right.notes.push(marker.note);
    }
    groups.push({ people: [best.left, best.right], marker });
  }
  // A relationship can have both a wedding branch and a separate = sign.
  // Resolve these together before selecting any current partner.
  const combined = new Map<string, Group>();
  for (const group of groups) {
    const key = unionKey(group.people[0].id, group.people[1].id);
    const previous = combined.get(key);
    if (!previous) { combined.set(key, group); continue; }
    const markers = [previous.marker!, group.marker!];
    const wedding = markers.find((marker) => marker.kind === "marriage" || marker.kind === "divorce");
    const separated = markers.some((marker) => marker.kind === "equals" || marker.kind === "divorce");
    previous.marker = wedding
      ? { ...wedding, kind: separated ? "divorce" : "marriage" }
      : { ...previous.marker!, kind: separated ? "equals" : "minus" };
  }
  groups.splice(0, groups.length, ...combined.values());
  const linked = new Set(groups.flatMap((group) => group.people.map((person) => person.id)));
  for (const card of sorted) if (!linked.has(card.id)) groups.push({ people: [card] });
  return groups.sort((left, right) => left.people[0].x - right.people[0].x);
}

function chooseUnions(groups: Group[]): Union[] {
  const couples = groups.filter((group) => group.people.length === 2 && group.marker);
  const chosen = new Map<string, Group>();
  for (const card of couples.flatMap((group) => group.people)) {
    const own = couples.filter((group) => group.people.includes(card));
    const current = currentLink(own);
    if (current) chosen.set(card.id, current);
  }
  const active = new Set<Group>();
  for (const group of couples) {
    const [left, right] = group.people;
    if (chosen.get(left.id) === group && chosen.get(right.id) === group) active.add(group);
  }
  const unions = new Map<string, Union>();
  for (const group of couples) {
    const [left, right] = group.people;
    const kind = group.marker!.kind;
    const current = active.has(group) && kind !== "divorce" && kind !== "equals";
    const union: Union = {
      id: unionKey(left.id, right.id),
      a: left.id,
      b: right.id,
      status: current ? "active" : "separated",
      ended: false,
      marriage: kind === "marriage" || kind === "divorce" ? (current ? "married" : "divorced") : "unspecified",
    };
    if (group.marker?.date && (kind === "marriage" || kind === "divorce")) union.marriedOn = group.marker.date;
    const existing = unions.get(union.id);
    if (!existing || union.status === "active") unions.set(union.id, union);
  }
  return [...unions.values()];
}

function currentLink(groups: Group[]) {
  const minus = groups.filter((group) => group.marker?.kind === "minus").sort((left, right) => right.marker!.x - left.marker!.x);
  if (minus[0]) return minus[0];
  const marriages = groups
    .filter((group) => group.marker?.kind === "marriage" || group.marker?.kind === "divorce")
    .sort((left, right) => newer(left.marker!, right.marker!));
  // A newer divorced marriage must not reactivate an earlier marriage.
  return marriages[0]?.marker?.kind === "marriage" ? marriages[0] : undefined;
}

function newer(left: Marker, right: Marker) {
  if (left.date && right.date && left.date !== right.date) return left.date > right.date ? -1 : 1;
  if (left.date !== right.date) return left.date ? -1 : 1;
  return right.x - left.x;
}

function assignChildren(parents: Group[], children: Group[], lines: ChartLine[]) {
  const childCards = [...new Map(children.flatMap((group) => group.people).map((card) => [card.id, card])).values()];
  const married = parents.filter((group) => group.marker && (group.marker.kind === "marriage" || group.marker.kind === "divorce"));
  const top = parents.flatMap((group) => group.people).reduce((y, person) => Math.max(y, person.y), Number.NEGATIVE_INFINITY);
  const bottom = childCards.reduce((y, person) => Math.min(y, person.y), Number.POSITIVE_INFINITY);
  const span = top - bottom;
  const connectors = span > 200 ? connectorsBetween(lines, top, bottom) : { bars: [], verticals: [] };
  const sloped = span > 200 ? lines.filter((line) => childSlope(line, top, bottom, span)) : [];
  if (!connectors.bars.length && !connectors.verticals.length && !sloped.length || !married.length) {
    const spans = parentSpans(married.length ? married : parents.filter((group) => group.people.length === 2));
    for (const child of children) {
      const center = (child.people[0].x + child.people.at(-1)!.x) / 2;
      const band = spans.find((item) => center >= item.from && center < item.to);
      if (!band) continue;
      for (const person of child.people.filter((item) => matchesFamily(item, band.surnames))) person.parents = band.ids;
    }
    return;
  }
  const claimed = new Map<string, number>();
  for (const group of married) {
    const center = (group.people[0].x + group.people[1].x) / 2;
    const ids = group.people.map((person) => person.id);
    const owned = connectors.verticals.filter((line) => {
      const distance = Math.abs(line.x1 - center);
      if (distance > 700) return false;
      return married.every((other) => {
        if (other === group) return true;
        const otherCenter = (other.people[0].x + other.people[1].x) / 2;
        return distance <= Math.abs(line.x1 - otherCenter) + 1;
      });
    });
    for (const trunk of owned) {
      if (connectors.bars.some((bar) => intersects(bar, trunk))) continue;
      const low = Math.min(trunk.y1, trunk.y2);
      if (low <= bottom + span * 0.2) claim(childCards, claimed, trunk.x1, ids, 420);
    }
    for (const bar of connectors.bars) {
      const meeting = owned.filter((trunk) => intersects(bar, trunk));
      if (!meeting.length || foreignTrunk(bar, meeting, connectors.verticals, married, group)) continue;
      for (const drop of connectors.verticals) {
        const x = (drop.x1 + drop.x2) / 2;
        if (!hangsTowardChildren(bar, drop) || outsideFamily(x, group, married)) continue;
        claim(childCards, claimed, x, ids, 380);
      }
      for (const end of [bar.x1, bar.x2]) {
        if (meeting.some((trunk) => Math.abs(end - (trunk.x1 + trunk.x2) / 2) < 60) || outsideFamily(end, group, married)) continue;
        claim(childCards, claimed, end, ids, 280);
      }
    }
  }
  for (const line of sloped) {
    const highY = Math.max(line.y1, line.y2);
    const lowY = Math.min(line.y1, line.y2);
    const highX = line.y1 === highY ? line.x1 : line.x2;
    const lowX = line.y1 === lowY ? line.x1 : line.x2;
    let best: { ids: string[]; distance: number } | undefined;
    let second = Number.POSITIVE_INFINITY;
    for (const group of married) {
      const center = (group.people[0].x + group.people[1].x) / 2;
      const distance = Math.abs(center - highX);
      if (!best || distance < best.distance) {
        second = best?.distance ?? second;
        best = { ids: group.people.map((person) => person.id), distance };
      } else if (distance < second) second = distance;
    }
    if (!best || best.distance > 750 || second - best.distance < 160 || Math.abs(highX - lowX) > 4200) continue;
    const near = childCards
      .map((person) => Math.abs(person.x - lowX))
      .sort((left, right) => left - right);
    if (near[0] > 480 || (near[1] !== undefined && near[0] > 220 && near[1] - near[0] < 90)) continue;
    claim(childCards, claimed, lowX, best.ids, 480);
  }
  for (const line of sloped) {
    const highY = Math.max(line.y1, line.y2);
    const lowY = Math.min(line.y1, line.y2);
    const highX = line.y1 === highY ? line.x1 : line.x2;
    const lowX = line.y1 === lowY ? line.x1 : line.x2;
    const open = childCards.filter((person) => !person.parents.length);
    if (!open.length || Math.abs(highX - lowX) > 6000) continue;
    let best: { ids: string[]; distance: number } | undefined;
    let second = Number.POSITIVE_INFINITY;
    for (const group of married) {
      const center = (group.people[0].x + group.people[1].x) / 2;
      const distance = Math.abs(center - highX);
      if (!best || distance < best.distance) {
        second = best?.distance ?? second;
        best = { ids: group.people.map((person) => person.id), distance };
      } else if (distance < second) second = distance;
    }
    if (!best || best.distance > 1200 || second - best.distance < 80) continue;
    const ranked = open
      .map((person) => ({ person, gap: Math.abs(person.x - lowX) }))
      .sort((left, right) => left.gap - right.gap);
    if (!ranked[0] || ranked[0].gap > 420) continue;
    if (ranked[1] && ranked[0].gap > 180 && ranked[1].gap - ranked[0].gap < 90) continue;
    ranked[0].person.parents = best.ids;
  }
  preferNearestStroke(childCards, married, connectors, sloped);
  releaseUnsupported(childCards, married, connectors, sloped);
}

function connectorsBetween(lines: ChartLine[], top: number, bottom: number) {
  const span = top - bottom;
  const overlaps = (line: ChartLine) => {
    const high = Math.max(line.y1, line.y2);
    const low = Math.min(line.y1, line.y2);
    const gapTop = top - span * 0.12;
    return high > bottom && low < gapTop && Math.min(high, gapTop) - Math.max(low, bottom - span * 0.05) > span * 0.08;
  };
  const bars = lines.filter((line) => {
    const width = Math.abs(line.x1 - line.x2);
    const y = (line.y1 + line.y2) / 2;
    return Math.abs(line.y1 - line.y2) < 30 && width >= 40 && width <= 22000 && y < top - span * 0.42 && y > bottom - span * 0.05;
  });
  const verticals = lines.filter((line) => {
    const length = Math.abs(line.y1 - line.y2);
    return Math.abs(line.x1 - line.x2) < 80 && length > span * 0.08 && length < span * 0.75 && overlaps(line);
  });
  return { bars, verticals };
}

function claim(cards: Card[], claimed: Map<string, number>, x: number, parents: string[], limit = 400) {
  const ranked = cards
    .map((person) => ({ person, gap: Math.abs(person.x - x) }))
    .filter((item) => item.gap < limit)
    .sort((left, right) => left.gap - right.gap);
  const best = ranked[0];
  if (!best) return;
  const next = ranked[1];
  if (next && best.gap > limit * 0.45 && next.gap - best.gap < 90) return;
  const card = best.person;
  const previous = claimed.get(card.id);
  if (previous !== undefined && previous <= best.gap) return;
  claimed.set(card.id, best.gap);
  card.parents = parents;
}

/** A nearer couple that actually has a stroke to this person replaces a far attachment. */
function preferNearestStroke(
  cards: Card[],
  married: Group[],
  connectors: { bars: ChartLine[]; verticals: ChartLine[] },
  sloped: ChartLine[],
) {
  const people = married.flatMap((group) => group.people);
  for (const card of cards) {
    if (!card.parents.length) continue;
    const known = card.parents
      .map((id) => people.find((person) => person.id === id))
      .filter((person): person is Card => Boolean(person));
    if (!known.length) continue;
    const mid = known.reduce((sum, person) => sum + person.x, 0) / known.length;
    const mine = Math.abs(card.x - mid);
    let better: { ids: string[]; distance: number } | undefined;
    for (const group of married) {
      const center = (group.people[0].x + group.people[1].x) / 2;
      const distance = Math.abs(card.x - center);
      if (distance + 500 >= mine) continue;
      const ownsStroke =
        connectors.verticals.some((line) => Math.abs(line.x1 - card.x) < 420 && Math.abs(line.x1 - center) < 900) ||
        connectors.bars.some((line) => {
          const left = Math.min(line.x1, line.x2) - 80;
          const right = Math.max(line.x1, line.x2) + 80;
          if (card.x < left || card.x > right) return false;
          return connectors.verticals.some(
            (trunk) => intersects(line, trunk) && Math.abs(trunk.x1 - center) < 800,
          );
        }) ||
        sloped.some((line) => {
          const lowX = line.y1 < line.y2 ? line.x1 : line.x2;
          const highX = line.y1 > line.y2 ? line.x1 : line.x2;
          return Math.abs(lowX - card.x) < 480 && Math.abs(highX - center) < 750;
        });
      if (!ownsStroke) continue;
      if (!better || distance < better.distance)
        better = { ids: group.people.map((person) => person.id), distance };
    }
    if (better) card.parents = better.ids;
  }
}

/** A child far from the recorded couple stays unattached when no stroke of that couple reaches them. */
function releaseUnsupported(
  cards: Card[],
  married: Group[],
  connectors: { bars: ChartLine[]; verticals: ChartLine[] },
  sloped: ChartLine[],
) {
  const people = married.flatMap((group) => group.people);
  for (const card of cards) {
    if (!card.parents.length) continue;
    const known = card.parents
      .map((id) => people.find((person) => person.id === id))
      .filter((person): person is Card => Boolean(person));
    if (!known.length) continue;
    const mid = known.reduce((sum, person) => sum + person.x, 0) / known.length;
    const mine = Math.abs(card.x - mid);
    const nearer = married.some((group) => {
      const center = (group.people[0].x + group.people[1].x) / 2;
      return Math.abs(card.x - center) + 600 < mine;
    });
    if (!nearer) continue;
    const slope = sloped.some((line) => {
      const lowX = line.y1 < line.y2 ? line.x1 : line.x2;
      const highX = line.y1 > line.y2 ? line.x1 : line.x2;
      return Math.abs(lowX - card.x) < 480 && Math.abs(highX - mid) < 750;
    });
    const drop = connectors.verticals.some(
      (line) => Math.abs(line.x1 - card.x) < 420 && Math.abs(line.x1 - mid) < 800,
    );
    const bar = connectors.bars.some((line) => {
      const left = Math.min(line.x1, line.x2) - 80;
      const right = Math.max(line.x1, line.x2) + 80;
      if (card.x < left || card.x > right) return false;
      return connectors.verticals.some(
        (trunk) => intersects(line, trunk) && Math.abs(trunk.x1 - mid) < 800,
      );
    });
    if (!slope && !drop && !bar) card.parents = [];
  }
}

function outsideFamily(x: number, group: Group, married: Group[]) {
  const center = (group.people[0].x + group.people[1].x) / 2;
  const mine = Math.abs(x - center);
  return married.some((other) => {
    if (other === group) return false;
    const otherCenter = (other.people[0].x + other.people[1].x) / 2;
    return Math.abs(x - otherCenter) + 60 < mine;
  });
}

function childSlope(line: ChartLine, top: number, bottom: number, span: number) {
  const dy = Math.abs(line.y2 - line.y1);
  const dx = Math.abs(line.x2 - line.x1);
  if (dy <= span * 0.2 || dy >= span * 0.9 || dx <= 60) return false;
  const highY = Math.max(line.y1, line.y2);
  const lowY = Math.min(line.y1, line.y2);
  return highY <= top - span * 0.05 && lowY >= bottom - span * 0.08;
}

function intersects(bar: ChartLine, line: ChartLine) {
  const barY = (bar.y1 + bar.y2) / 2;
  const x = (line.x1 + line.x2) / 2;
  const high = Math.max(line.y1, line.y2);
  const low = Math.min(line.y1, line.y2);
  const left = Math.min(bar.x1, bar.x2) - 45;
  const right = Math.max(bar.x1, bar.x2) + 45;
  return x >= left && x <= right && low <= barY + 45 && high >= barY - 45;
}

function hangsTowardChildren(bar: ChartLine, line: ChartLine) {
  if (!intersects(bar, line)) return false;
  return Math.min(line.y1, line.y2) < (bar.y1 + bar.y2) / 2 - 25;
}

function foreignTrunk(
  bar: ChartLine,
  meeting: ChartLine[],
  verticals: ChartLine[],
  married: Group[],
  group: Group,
) {
  const barY = (bar.y1 + bar.y2) / 2;
  const ownX = meeting.map((trunk) => (trunk.x1 + trunk.x2) / 2);
  return verticals.some((line) => {
    const x = (line.x1 + line.x2) / 2;
    if (ownX.some((own) => Math.abs(own - x) < 40) || !intersects(bar, line)) return false;
    if (Math.max(line.y1, line.y2) < barY + 80) return false;
    return married.some((other) => {
      if (other === group) return false;
      const otherCenter = (other.people[0].x + other.people[1].x) / 2;
      return Math.abs(x - otherCenter) < 700;
    });
  });
}

function parentSpans(groups: Group[]) {
  const centers = groups.map((group) => (group.people[0].x + group.people.at(-1)!.x) / 2);
  return groups.map((group, index) => ({
    from: index === 0 ? -Infinity : (centers[index - 1] + centers[index]) / 2,
    to: index === groups.length - 1 ? Infinity : (centers[index] + centers[index + 1]) / 2,
    ids: group.people.map((person) => person.id),
    surnames: group.people.map(birthSurname).filter(Boolean),
  }));
}

function matchesFamily(person: Card, surnames: string[]) {
  const birth = birthSurname(person);
  return Boolean(birth) && surnames.some((surname) => surname.localeCompare(birth, "de", { sensitivity: "accent" }) === 0);
}

function birthSurname(person: Card) {
  return person.birthName || person.surname.split("/")[0]?.trim() || "";
}

function nearestText(items: ChartItem[], x: number) {
  let best: ChartItem | undefined;
  let distance = 450;
  for (const item of items) {
    const gap = Math.abs(item.x - x);
    if (gap < distance) {
      distance = gap;
      best = item;
    }
  }
  return best;
}

function nearestCard(cards: Card[], x: number) {
  let best: Card | undefined;
  let distance = 450;
  for (const card of cards) {
    const gap = Math.abs(card.x - x);
    if (gap < distance) {
      distance = gap;
      best = card;
    }
  }
  return best;
}

function cleanName(value: string) {
  const name = value.trim();
  if (!name || /^[.\s]+$/.test(name) || /^\d+$/.test(name)) return "...";
  return name;
}

function kindOf(text: string) {
  if (/^\*\s*/.test(text)) return "birth";
  if (/^\+\s*/.test(text)) return "death";
  if (/^o\|o\b/i.test(text) || /^geschieden\b/i.test(text)) return "divorce";
  if (/^=+/.test(text)) return "equals";
  if (/^oo\s+LAG\b/i.test(text)) return "minus";
  if (/^o-o$/i.test(text) || /^[-–—]+(?:\s+\.\.\.)?$/.test(text)) return "minus";
  if (/^oo\b/i.test(text)) return "marriage";
  return "name";
}

function readDate(value: string) {
  const full = value.match(/(\d{1,2})[.](\d{1,2})[.](\d{4})/);
  if (full) {
    const iso = `${full[3]}-${full[2].padStart(2, "0")}-${full[1].padStart(2, "0")}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso) return { iso };
  }
  const token = value.replace(/^[.*+\s]+|[.*+\s]+$/g, "").trim();
  if (token && /\d/.test(token) && !/^\.+$/.test(token)) return { note: token };
  return {};
}
