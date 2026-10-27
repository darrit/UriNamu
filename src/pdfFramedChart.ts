import { parseChart, type ChartItem, type ChartLine } from "./pdfChart";
import { normalize, unionKey, type Family } from "./domain";

export type ChartBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Read framed descendant charts from their printed geometry, not surname proximity. */
export function parseFramedChart(
  items: ChartItem[],
  lines: ChartLine[],
  painted: ChartBox[],
  name: string,
): Family | null {
  const typicalHeight = median(painted.map((b) => b.top - b.bottom));
  const boxes = painted
    .filter((b) => b.top - b.bottom < typicalHeight * 2)
    .filter((box) => items.filter((item) => inside(item, box)).length >= 2)
    .sort(
      (a, b) =>
        (b.right - b.left) * (b.top - b.bottom) -
        (a.right - a.left) * (a.top - a.bottom),
    )
    .filter(
      (box, index, all) =>
        !all
          .slice(0, index)
          .some(
            (other) =>
              Math.abs(other.left - box.left) < 3 &&
              Math.abs(other.top - box.top) < 3,
          ),
    );
  if (boxes.length < 2) return null;
  const height = median(boxes.map((b) => b.top - b.bottom));
  const width = median(boxes.map((b) => b.right - b.left));
  const scale = 900 / width;
  const rows: ChartBox[][] = [];
  for (const box of boxes.sort((a, b) => b.top - a.top || a.left - b.left)) {
    const row = rows.find(
      (row) => Math.abs(row[0].top - box.top) < height * 0.25,
    );
    if (row) row.push(box);
    else rows.push([box]);
  }
  const ordered = rows.flatMap((row) => row.sort((a, b) => a.left - b.left));
  const synthetic: ChartItem[] = [];
  const titles = items.filter((item) => /^Tafel\b/i.test(item.text));
  if (titles[0]) synthetic.push({ x: 0, y: 2000, text: titles[0].text });
  ordered.forEach((box) => {
    const rank = rows.findIndex((row) => row.includes(box));
    const text = items
      .filter((item) => inside(item, box))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const names = text.filter((item) => !/^\s*[*+†]/.test(item.text));
    const x = ((box.left + box.right) / 2) * scale;
    synthetic.push({ x, y: -rank * 1800, text: names[0]?.text || "..." });
    synthetic.push({
      x,
      y: -rank * 1800 - 160,
      text:
        names
          .slice(1)
          .map((item) => item.text)
          .join(" ") || "...",
    });
    for (const item of text.filter((item) => /^\s*[*+†]/.test(item.text)))
      synthetic.push({
        x,
        y: -rank * 1800 - 320 - (item.text.startsWith("*") ? 0 : 160),
        text: item.text.replace(/^†/, "+"),
      });
  });
  const markers = items.filter(
    (item) =>
      !boxes.some((box) => inside(item, box)) &&
      /^(oo\b|o\|o\b|o-o$|[-–—=]+$)/i.test(item.text),
  );
  // Some exporters draw the partner signs as strokes instead of PDF text.
  for (const row of rows) {
    row.slice(0, -1).forEach((left, index) => {
      const right = row[index + 1];
      const gap = right.left - left.right;
      if (gap <= 0 || gap > width * 0.5) return;
      const middle = (left.top + left.bottom) / 2;
      const strokes = lines.filter(
        (line) =>
          Math.abs(line.y1 - line.y2) < height * 0.01 &&
          Math.abs(line.y1 - middle) < height * 0.3 &&
          Math.min(line.x1, line.x2) >= left.right - height * 0.04 &&
          Math.max(line.x1, line.x2) <= right.left + height * 0.04 &&
          Math.abs(line.x2 - line.x1) > gap * 0.2,
      );
      const double = strokes.some((a, i) =>
        strokes
          .slice(i + 1)
          .some(
            (b) =>
              Math.abs(a.y1 - b.y1) > height * 0.01 &&
              Math.abs(a.y1 - b.y1) < height * 0.15 &&
              Math.abs(Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2)) <
                gap * 0.15 &&
              Math.abs(Math.max(a.x1, a.x2) - Math.max(b.x1, b.x2)) <
                gap * 0.15,
          ),
      );
      if (strokes.length)
        markers.push({
          x: (left.right + right.left) / 2,
          y: middle,
          text: double ? "=" : "-",
        });
    });
  }
  for (const marker of markers) {
    const rank = rows.findIndex(
      (row) =>
        (marker.y < row[0].bottom &&
          marker.y > row[0].bottom - height * 0.55) ||
        (/^(?:[-–—=]+|o-o)$/.test(marker.text) &&
          marker.y <= row[0].top &&
          marker.y >= row[0].bottom &&
          row.some(
            (box, i) =>
              row[i + 1] && marker.x > box.right && marker.x < row[i + 1].left,
          )),
    );
    if (rank >= 0)
      synthetic.push({
        x: marker.x * scale,
        y: -rank * 1800 - 700,
        text: marker.text,
      });
  }
  const family = parseChart(synthetic, name, [], false);
  if (!family || family.members.length !== ordered.length) return null;
  // parseChart creates people in generation/left-to-right order.
  const people = ordered.map((box) => {
    const rank = rows.findIndex((row) => row.includes(box));
    const index = rows[rank].indexOf(box);
    return family.members.find(
      (p) =>
        p.positions?.classic?.y === rank * 250 &&
        p.positions.classic.x === index * 280,
    )!;
  });
  if (people.some((p) => !p)) return null;
  people.forEach((p) => (p.parents = []));
  const epsilon = height * 0.035;
  for (let rank = 0; rank < rows.length - 1; rank++) {
    const upper = rows[rank],
      lower = rows[rank + 1];
    if (upper[0].top - lower[0].top > height * 8) continue;
    const corridor = lines.filter(
      (l) =>
        Math.max(l.y1, l.y2) <= upper[0].bottom + epsilon &&
        Math.min(l.y1, l.y2) >= lower[0].top - epsilon,
    );
    const claims = new Map<number, string[][]>();
    for (const union of family.unions) {
      const ai = people.findIndex((p) => p.id === union.a),
        bi = people.findIndex((p) => p.id === union.b);
      if (!upper.includes(ordered[ai]) || !upper.includes(ordered[bi]))
        continue;
      const a = ordered[ai],
        b = ordered[bi];
      const center = (a.left + a.right + b.left + b.right) / 4;
      const coupleWidth = Math.abs((a.left + a.right - b.left - b.right) / 2);
      const seed = corridor
        .filter(
          (l) =>
            Math.abs(l.y1 - l.y2) < epsilon &&
            Math.abs((l.x1 + l.x2) / 2 - center) < width * 0.2 &&
            Math.abs(Math.abs(l.x2 - l.x1) - coupleWidth) < width * 0.3 &&
            upper[0].bottom - l.y1 < height * 0.5,
        )
        .sort((a, b) => b.y1 - a.y1)[0];
      if (!seed) continue;
      const available = corridor.filter(
        (l) => Math.max(l.y1, l.y2) <= seed.y1 + epsilon,
      );
      const reached = new Set<ChartLine>([seed]);
      const queue = [seed];
      while (queue.length) {
        const current = queue.pop()!;
        for (const candidate of available) {
          if (reached.has(candidate) || !joined(current, candidate, epsilon))
            continue;
          reached.add(candidate);
          queue.push(candidate);
        }
      }
      for (const box of lower) {
        const cx = (box.left + box.right) / 2;
        const landed = [...reached].some((l) =>
          [
            { x: l.x1, y: l.y1 },
            { x: l.x2, y: l.y2 },
          ].some(
            (p) =>
              Math.abs(p.x - cx) < width * 0.15 &&
              p.y >= box.top - epsilon &&
              p.y <= box.top + height * 0.12,
          ),
        );
        if (landed) {
          const index = ordered.indexOf(box);
          claims.set(index, [...(claims.get(index) ?? []), [union.a, union.b]]);
        }
      }
    }
    for (const [index, candidates] of claims)
      if (candidates.length === 1) people[index].parents = candidates[0];
  }
  // In descendant charts, a run of partners belongs to the descendant at
  // its centre, even when the signs are printed between successive spouses.
  for (const row of rows) {
    const ids = new Set(row.map((box) => people[ordered.indexOf(box)].id));
    const remaining = new Set(ids);
    for (const start of ids) {
      if (!remaining.has(start)) continue;
      const component = new Set<string>();
      const queue = [start];
      while (queue.length) {
        const id = queue.pop()!;
        if (!remaining.delete(id)) continue;
        component.add(id);
        for (const u of family.unions) {
          const other = u.a === id ? u.b : u.b === id ? u.a : undefined;
          if (other && ids.has(other)) queue.push(other);
        }
      }
      if (component.size < 3) continue;
      const links = family.unions.filter(
        (u) => component.has(u.a) && component.has(u.b),
      );
      const candidates = people.filter(
        (p) =>
          component.has(p.id) &&
          p.parents.length &&
          links.filter((u) => u.a === p.id || u.b === p.id).length >= 2,
      );
      if (candidates.length !== 1) continue;
      const hub = candidates[0].id;
      const visited = new Set([hub]);
      const pending = [hub];
      while (pending.length) {
        const from = pending.shift()!;
        for (const u of links.filter((u) => u.a === from || u.b === from)) {
          const other = u.a === from ? u.b : u.a;
          if (visited.has(other)) continue;
          visited.add(other);
          pending.push(other);
          if (from === hub) continue;
          const old = [u.a, u.b];
          u.a = hub;
          u.b = other;
          u.id = unionKey(hub, other);
          for (const child of people)
            if (
              child.parents.length === 2 &&
              old.every((id) => child.parents.includes(id))
            )
              child.parents = [hub, other];
        }
      }
      const current = links
        .filter((u) => u.status === "active")
        .sort(
          (a, b) =>
            Number(b.marriage === "unspecified") -
              Number(a.marriage === "unspecified") ||
            (b.marriedOn ?? "").localeCompare(a.marriedOn ?? ""),
        );
      for (const former of current.slice(1)) {
        former.status = "separated";
        if (former.marriage === "married") former.marriage = "divorced";
      }
    }
  }
  // One shared horizontal coordinate system preserves alignment between generations.
  const minX = Math.min(...ordered.map((b) => b.left));
  ordered.forEach((box, i) => {
    const rank = rows.findIndex((row) => row.includes(box));
    const x = ((box.left - minX) / width) * 240;
    people[i].positions = {
      classic: { x, y: rank * 250 },
      horizontal: { x: rank * 340, y: x },
      tapestry: { x, y: rank * 240 },
      chart: { x, y: rank * 230 },
    };
  });
  return normalize(family);
}
function inside(item: ChartItem, box: ChartBox) {
  return (
    item.x >= box.left &&
    item.x <= box.right &&
    item.y >= box.bottom &&
    item.y <= box.top
  );
}
function median(values: number[]) {
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}
function touches(x: number, y: number, line: ChartLine, epsilon: number) {
  const dx = line.x2 - line.x1,
    dy = line.y2 - line.y1;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((x - line.x1) * dx + (y - line.y1) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(x - line.x1 - t * dx, y - line.y1 - t * dy) <= epsilon;
}
/** T-junctions connect; crossings in the middle of two strokes do not. */
function joined(a: ChartLine, b: ChartLine, e: number) {
  return (
    touches(a.x1, a.y1, b, e) ||
    touches(a.x2, a.y2, b, e) ||
    touches(b.x1, b.y1, a, e) ||
    touches(b.x2, b.y2, a, e)
  );
}
