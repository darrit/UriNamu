import { normalize, type Family } from "./domain";
import { parseChart, type ChartItem, type ChartLine } from "./pdfChart";
import { parseFramedChart, type ChartBox } from "./pdfFramedChart";
import { familyNameFromFile, parseGenericFamily } from "./pdfText";

export const PDF_BYTE_LIMIT = 80 * 1024 * 1024;
const ATTACHMENT = "urinamu-family.json";
const ATTACHMENT_LIMIT = 2 * 1024 * 1024;
const TEXT_LIMIT = 1_500_000;
const PAGE_LIMIT = 300;

export class PdfReadError extends Error {
  constructor(readonly code: "invalid" | "encrypted" | "too-big") {
    super(code);
  }
}

export type PdfReading = {
  embedded: Family | null;
  generic: Family | null;
  embeddedBroken: boolean;
  hasText: boolean;
  truncated: boolean;
  partial: boolean;
  layout: "chart" | "text" | "none";
};

type FontDecode = { width: 1 | 2; map: Map<number, string> | null };
type Item =
  | { kind: "num"; value: number }
  | { kind: "name"; value: string }
  | { kind: "str"; bytes: Uint8Array }
  | { kind: "arr"; items: Item[] }
  | { kind: "dict"; actual: string };

const WIN: FontDecode = { width: 1, map: null };
const CP1252: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

export async function readPdf(
  bytes: Uint8Array,
  fileName: string,
): Promise<PdfReading> {
  if (bytes.length > PDF_BYTE_LIMIT) throw new PdfReadError("too-big");
  if (!hasPdfHeader(bytes)) throw new PdfReadError("invalid");
  const pdfLib = await import("pdf-lib");
  let pdf: import("pdf-lib").PDFDocument;
  try {
    pdf = await pdfLib.PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof pdfLib.EncryptedPDFError)
      throw new PdfReadError("encrypted");
    throw new PdfReadError("invalid");
  }
  const embedded = readEmbedded(pdf, pdfLib);
  const pageCount = pdf.getPageCount();
  const extracted = extractDocument(
    pdf,
    pdfLib,
    Math.min(pageCount, PAGE_LIMIT),
  );
  const text = extracted.text;
  const fallbackName = familyNameFromFile(fileName) || "Familie";
  const chart =
    parseFramedChart(
      extracted.items,
      extracted.lines,
      extracted.boxes,
      fallbackName,
    ) ??
    parseChart(
      extracted.items.map((item) => ({
        ...item,
        x: item.x / 0.12,
        y: item.y / 0.12,
      })),
      fallbackName,
      extracted.lines.map((line) => ({
        x1: line.x1 / 0.12,
        y1: line.y1 / 0.12,
        x2: line.x2 / 0.12,
        y2: line.y2 / 0.12,
      })),
    );
  const parsed = chart
    ? { family: chart, truncated: false }
    : parseGenericFamily(text, familyNameFromFile(fileName) || "Familie");
  const visible = text
    .replace(/urinamu(?:\s+\d+\s*\/\s*\d+)?/gi, " ")
    .replace(/\d+\s*\/\s*\d+/g, " ");
  return {
    embedded: embedded.family,
    generic: parsed.family,
    embeddedBroken: embedded.broken,
    hasText: /\p{L}/u.test(visible),
    truncated: parsed.truncated,
    partial: pageCount > PAGE_LIMIT,
    layout: chart ? "chart" : parsed.family ? "text" : "none",
  };
}

function hasPdfHeader(bytes: Uint8Array) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

function readEmbedded(
  pdf: import("pdf-lib").PDFDocument,
  pdfLib: typeof import("pdf-lib"),
): { family: Family | null; broken: boolean } {
  try {
    const names = pdf.catalog.lookupMaybe(
      pdfLib.PDFName.of("Names"),
      pdfLib.PDFDict,
    );
    if (!names) return { family: null, broken: false };
    const embedded = names.lookupMaybe(
      pdfLib.PDFName.of("EmbeddedFiles"),
      pdfLib.PDFDict,
    );
    if (!embedded) return { family: null, broken: false };
    const files: { name: string; bytes: Uint8Array }[] = [];
    collectFiles(embedded, pdfLib, files, 0);
    const file = files.find((item) => item.name === ATTACHMENT);
    if (!file) return { family: null, broken: false };
    if (file.bytes.length > ATTACHMENT_LIMIT)
      return { family: null, broken: true };
    const raw = JSON.parse(new TextDecoder().decode(file.bytes)) as unknown;
    return { family: calmFamily(raw), broken: false };
  } catch {
    return { family: null, broken: true };
  }
}

function collectFiles(
  node: import("pdf-lib").PDFDict,
  pdfLib: typeof import("pdf-lib"),
  out: { name: string; bytes: Uint8Array }[],
  depth: number,
) {
  if (depth > 5) return;
  const names = node.lookupMaybe(pdfLib.PDFName.of("Names"), pdfLib.PDFArray);
  if (names) {
    for (let index = 0; index + 1 < names.size(); index += 2) {
      const spec = names.lookupMaybe(index + 1, pdfLib.PDFDict);
      const ef = spec?.lookupMaybe(pdfLib.PDFName.of("EF"), pdfLib.PDFDict);
      const stream =
        asRawStream(ef?.lookup(pdfLib.PDFName.of("F")), pdfLib) ??
        asRawStream(ef?.lookup(pdfLib.PDFName.of("UF")), pdfLib);
      if (!stream) continue;
      try {
        out.push({
          name: pdfText(names.lookup(index)),
          bytes: pdfLib.decodePDFRawStream(stream).decode(),
        });
      } catch {
        continue;
      }
    }
  }
  const kids = node.lookupMaybe(pdfLib.PDFName.of("Kids"), pdfLib.PDFArray);
  if (!kids) return;
  for (let index = 0; index < kids.size(); index += 1) {
    const kid = kids.lookupMaybe(index, pdfLib.PDFDict);
    if (kid) collectFiles(kid, pdfLib, out, depth + 1);
  }
}

function pdfText(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "decodeText" in value &&
    typeof value.decodeText === "function"
  )
    return String(value.decodeText());
  return "";
}

function calmFamily(raw: unknown): Family | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as { members?: unknown[] };
  if (!Array.isArray(source.members) || source.members.length > 5000)
    return null;
  for (const member of source.members) {
    if (!member || typeof member !== "object") continue;
    const person = member as {
      photo?: unknown;
      bio?: unknown;
      dynasty?: { logo?: unknown };
    };
    person.photo = "";
    if (typeof person.bio === "string" && person.bio.length > 20_000)
      person.bio = person.bio.slice(0, 20_000);
    if (person.dynasty && typeof person.dynasty === "object")
      person.dynasty.logo = "";
  }
  return normalize(raw);
}

export function extractDocument(
  pdf: import("pdf-lib").PDFDocument,
  pdfLib: typeof import("pdf-lib"),
  pages: number,
) {
  const lines: string[] = [];
  const items: ChartItem[] = [];
  const drawn: ChartLine[] = [];
  const boxes: ChartBox[] = [];
  for (
    let index = 0;
    index < pages && lines.join("\n").length < TEXT_LIMIT;
    index += 1
  ) {
    try {
      const page = pdf.getPage(index);
      const resources = page.node.normalizedEntries().Resources;
      // Keep pages separate: identical coordinates on different pages are not relatives.
      readStreams(
        contentOf(page.node, pdfLib),
        resources,
        pdfLib,
        lines,
        items,
        drawn,
        0,
        boxes,
        [1, 0, 0, 1, 0, -index * 100000],
      );
    } catch {
      continue;
    }
  }
  return {
    text: lines.join("\n").slice(0, TEXT_LIMIT),
    items,
    lines: drawn,
    boxes,
  };
}

function contentOf(
  node: { Contents: () => unknown },
  pdfLib: typeof import("pdf-lib"),
) {
  const contents = node.Contents();
  if (contents instanceof pdfLib.PDFRawStream) return [contents];
  if (contents instanceof pdfLib.PDFArray) {
    const streams = [];
    for (let index = 0; index < contents.size(); index += 1) {
      const item = contents.lookup(index);
      if (item instanceof pdfLib.PDFRawStream) streams.push(item);
    }
    return streams;
  }
  return [];
}

function readStreams(
  streams: import("pdf-lib").PDFRawStream[],
  resources: import("pdf-lib").PDFDict,
  pdfLib: typeof import("pdf-lib"),
  lines: string[],
  items: ChartItem[],
  drawn: ChartLine[],
  depth: number,
  boxes: ChartBox[] = [],
  matrix: number[] = [1, 0, 0, 1, 0, 0],
) {
  const fonts = fontMap(resources, pdfLib);
  const sources: string[] = [];
  for (const stream of streams) {
    let decoded: Uint8Array;
    try {
      decoded = pdfLib.decodePDFRawStream(stream).decode();
    } catch {
      continue;
    }
    if (decoded.length > 8_000_000) continue;
    sources.push(latin1(decoded));
  }
  readContent(
    sources.join("\n"),
    fonts,
    resources,
    pdfLib,
    lines,
    items,
    drawn,
    depth,
    boxes,
    matrix,
  );
}

function fontMap(
  resources: import("pdf-lib").PDFDict,
  pdfLib: typeof import("pdf-lib"),
) {
  const fonts = new Map<string, FontDecode>();
  const dict = resources.lookupMaybe(pdfLib.PDFName.of("Font"), pdfLib.PDFDict);
  if (!dict) return fonts;
  for (const key of dict.keys()) {
    const font = dict.lookupMaybe(key, pdfLib.PDFDict);
    if (!font) continue;
    const toUnicode = asRawStream(
      font.lookup(pdfLib.PDFName.of("ToUnicode")),
      pdfLib,
    );
    if (!toUnicode) {
      fonts.set(key.decodeText(), WIN);
      continue;
    }
    try {
      fonts.set(
        key.decodeText(),
        parseCMap(latin1(pdfLib.decodePDFRawStream(toUnicode).decode())),
      );
    } catch {
      fonts.set(key.decodeText(), WIN);
    }
  }
  return fonts;
}

export function textFromContent(source: string): string {
  const lines: string[] = [];
  readContent(source, new Map(), undefined, undefined, lines, [], [], 0);
  return lines.join("\n");
}

function readContent(
  source: string,
  fonts: Map<string, FontDecode>,
  resources: import("pdf-lib").PDFDict | undefined,
  pdfLib: typeof import("pdf-lib") | undefined,
  lines: string[],
  items: ChartItem[],
  drawn: ChartLine[],
  depth: number,
  boxes: ChartBox[] = [],
  initialMatrix: number[] = [1, 0, 0, 1, 0, 0],
) {
  let index = 0;
  const stack: Item[] = [];
  let font = WIN;
  let line = "";
  let marked = false;
  let textX = 0;
  let textY = 0;
  let pathX = 0;
  let pathY = 0;
  let pathStartX = 0;
  let pathStartY = 0;
  let path: ChartLine[] = [];
  let matrix = initialMatrix;
  let strokeLightness = 0;
  const saved: {
    matrix: number[];
    font: FontDecode;
    strokeLightness: number;
  }[] = [];
  const pointAt = (x: number, y: number) => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  });
  const transformedPath = () =>
    path.map((segment) => {
      const a = pointAt(segment.x1, segment.y1),
        b = pointAt(segment.x2, segment.y2);
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    });
  const captureBox = () => {
    if (path.length < 4 || boxes.length >= 20000) return;
    const points = transformedPath();
    const xs = points.flatMap((p) => [p.x1, p.x2]),
      ys = points.flatMap((p) => [p.y1, p.y2]);
    const left = Math.min(...xs),
      right = Math.max(...xs),
      bottom = Math.min(...ys),
      top = Math.max(...ys);
    const w = right - left,
      h = top - bottom;
    if (h > 10 && w > 10 && w / h > 0.6 && w / h < 4)
      boxes.push({ left, right, top, bottom });
  };
  const commitPath = () => {
    captureBox();
    if (strokeLightness < 0.8)
      for (const segment of transformedPath())
        if (drawn.length < 80000) drawn.push(segment);
    path = [];
  };
  const dropPath = () => {
    path = [];
  };
  const flush = () => {
    const text = line.replace(/[ \t]+/g, " ").trim();
    line = "";
    if (text && lines.join("\n").length < TEXT_LIMIT) lines.push(text);
  };
  const add = (bytes: Uint8Array) => {
    if (marked) return;
    const text = decodeBytes(bytes, font).replace(/\u0000/g, "");
    line += text;
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) items.push({ ...pointAt(textX, textY), text: clean });
  };
  while (index < source.length) {
    const parsed = parseValue(source, index);
    if (!parsed) break;
    index = parsed.index;
    if (parsed.op) {
      const op = parsed.op;
      if (op === "q")
        saved.push({ matrix: [...matrix], font, strokeLightness });
      else if (op === "Q") {
        const state = saved.pop();
        if (state) {
          matrix = state.matrix;
          font = state.font;
          strokeLightness = state.strokeLightness;
        }
      } else if (op === "cm")
        matrix = multiplyMatrix(matrix, takeNumbers(stack, 6));
      else if (op === "G") strokeLightness = takeNumbers(stack, 1)[0];
      else if (op === "RG")
        strokeLightness = Math.max(...takeNumbers(stack, 3));
      else if (op === "Tf") {
        stack.pop();
        const name = stack.pop();
        if (name?.kind === "name") font = fonts.get(name.value) ?? WIN;
      } else if (op === "Tj") {
        const value = stack.pop();
        if (value?.kind === "str") add(value.bytes);
      } else if (op === "'") {
        flush();
        const value = stack.pop();
        if (value?.kind === "str") add(value.bytes);
      } else if (op === '"') {
        flush();
        const value = stack.pop();
        stack.pop();
        stack.pop();
        if (value?.kind === "str") add(value.bytes);
      } else if (op === "TJ") {
        const value = stack.pop();
        if (value?.kind === "arr") {
          let text = "";
          for (const item of value.items) {
            if (item.kind === "str") text += decodeBytes(item.bytes, font);
            else if (item.kind === "num" && item.value <= -180) text += " ";
          }
          if (!marked && text) {
            line += text;
            const clean = text
              .replace(/\u0000/g, "")
              .replace(/\s+/g, " ")
              .trim();
            if (clean) items.push({ ...pointAt(textX, textY), text: clean });
          }
        }
      } else if (op === "m") {
        const point = takeNumbers(stack, 2);
        pathX = point[0];
        pathY = point[1];
        pathStartX = pathX;
        pathStartY = pathY;
      } else if (op === "l") {
        const point = takeNumbers(stack, 2);
        path.push({ x1: pathX, y1: pathY, x2: point[0], y2: point[1] });
        pathX = point[0];
        pathY = point[1];
      } else if (op === "c") {
        const point = takeNumbers(stack, 6);
        path.push({ x1: pathX, y1: pathY, x2: point[4], y2: point[5] });
        pathX = point[4];
        pathY = point[5];
      } else if (op === "v") {
        const point = takeNumbers(stack, 4);
        path.push({ x1: pathX, y1: pathY, x2: point[2], y2: point[3] });
        pathX = point[2];
        pathY = point[3];
      } else if (op === "y") {
        const point = takeNumbers(stack, 4);
        path.push({ x1: pathX, y1: pathY, x2: point[2], y2: point[3] });
        pathX = point[2];
        pathY = point[3];
      } else if (op === "h") {
        if (pathX !== pathStartX || pathY !== pathStartY)
          path.push({ x1: pathX, y1: pathY, x2: pathStartX, y2: pathStartY });
        pathX = pathStartX;
        pathY = pathStartY;
      } else if (op === "re") {
        const point = takeNumbers(stack, 4);
        const [x, y, w, h] = point;
        path.push({ x1: x, y1: y, x2: x + w, y2: y });
        path.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
        path.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
        path.push({ x1: x, y1: y + h, x2: x, y2: y });
        pathX = x;
        pathY = y;
        pathStartX = x;
        pathStartY = y;
      } else if (op === "S" || op === "B" || op === "B*") commitPath();
      else if (op === "s" || op === "b" || op === "b*") {
        if (pathX !== pathStartX || pathY !== pathStartY)
          path.push({ x1: pathX, y1: pathY, x2: pathStartX, y2: pathStartY });
        commitPath();
      } else if (op === "f" || op === "F" || op === "f*") {
        captureBox();
        dropPath();
      } else if (op === "n") dropPath();
      else if (op === "Tm") {
        const matrix = takeNumbers(stack, 6);
        textX = matrix[4];
        textY = matrix[5];
      } else if (op === "T*" || op === "ET") flush();
      else if (op === "Td" || op === "TD") {
        const shift = takeNumbers(stack, 2);
        textX += shift[0];
        textY += shift[1];
        if (shift[1] !== 0) flush();
      } else if (op === "BT") {
        if (line.trim()) flush();
        textX = 0;
        textY = 0;
      } else if (op === "BDC") {
        const props = stack.pop();
        stack.pop();
        if (props?.kind === "dict" && props.actual) {
          if (line && !line.endsWith(" ")) line += " ";
          line += props.actual;
          marked = true;
        }
      } else if (op === "EMC") marked = false;
      else if (op === "Do" && depth < 3 && resources && pdfLib) {
        const name = stack.pop();
        if (name?.kind === "name")
          followForm(
            name.value,
            resources,
            pdfLib,
            lines,
            items,
            drawn,
            depth,
            boxes,
            matrix,
          );
      } else if (stack.length > 30) stack.length = 0;
      continue;
    }
    if (parsed.item) stack.push(parsed.item);
  }
  flush();
}

function followForm(
  name: string,
  resources: import("pdf-lib").PDFDict,
  pdfLib: typeof import("pdf-lib"),
  lines: string[],
  items: ChartItem[],
  drawn: ChartLine[],
  depth: number,
  boxes: ChartBox[],
  matrix: number[],
) {
  const objects = resources.lookupMaybe(
    pdfLib.PDFName.of("XObject"),
    pdfLib.PDFDict,
  );
  const form = asRawStream(objects?.lookup(pdfLib.PDFName.of(name)), pdfLib);
  if (!form) return;
  const subtype = form.dict.lookup(pdfLib.PDFName.of("Subtype"));
  if (subtype !== pdfLib.PDFName.of("Form")) return;
  const nested =
    form.dict.lookupMaybe(pdfLib.PDFName.of("Resources"), pdfLib.PDFDict) ??
    resources;
  const formMatrix = form.dict.lookupMaybe(
    pdfLib.PDFName.of("Matrix"),
    pdfLib.PDFArray,
  );
  const local = formMatrix
    ?.asArray()
    .map((value) => (value instanceof pdfLib.PDFNumber ? value.asNumber() : 0));
  readStreams(
    [form],
    nested,
    pdfLib,
    lines,
    items,
    drawn,
    depth + 1,
    boxes,
    local?.length === 6 ? multiplyMatrix(matrix, local) : matrix,
  );
}

function multiplyMatrix(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function takeNumbers(stack: Item[], count: number) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const item = stack.pop();
    values.push(item?.kind === "num" ? item.value : 0);
  }
  return values.reverse();
}

function parseValue(
  source: string,
  start: number,
): { index: number; item?: Item; op?: string } | null {
  let index = skipSpace(source, start);
  if (index >= source.length) return null;
  const char = source[index];
  if (source.startsWith("<<", index)) return parseDict(source, index);
  if (char === "[") return parseArray(source, index);
  if (char === "(")
    return {
      index: endString(source, index).index,
      item: { kind: "str", bytes: endString(source, index).bytes },
    };
  if (char === "<")
    return {
      index: endHex(source, index).index,
      item: { kind: "str", bytes: endHex(source, index).bytes },
    };
  if (char === "/") {
    const name = readName(source, index);
    return { index: name.index, item: { kind: "name", value: name.value } };
  }
  if (
    char === "+" ||
    char === "-" ||
    char === "." ||
    (char >= "0" && char <= "9")
  ) {
    const number = readNumber(source, index);
    if (number)
      return {
        index: number.index,
        item: { kind: "num", value: number.value },
      };
  }
  const op = readOperator(source, index);
  if (!op) return { index: index + 1 };
  return { index: op.index, op: op.value };
}

function parseArray(source: string, start: number) {
  const items: Item[] = [];
  let index = start + 1;
  while (index < source.length) {
    index = skipSpace(source, index);
    if (source[index] === "]")
      return { index: index + 1, item: { kind: "arr" as const, items } };
    const parsed = parseValue(source, index);
    if (!parsed) break;
    index = parsed.index;
    if (parsed.item) items.push(parsed.item);
  }
  return { index, item: { kind: "arr" as const, items } };
}

function parseDict(source: string, start: number) {
  let index = start + 2;
  let actual = "";
  let pending = "";
  while (index < source.length) {
    index = skipSpace(source, index);
    if (source.startsWith(">>", index))
      return { index: index + 2, item: { kind: "dict" as const, actual } };
    const parsed = parseValue(source, index);
    if (!parsed) break;
    index = parsed.index;
    if (parsed.item?.kind === "name" && !pending) pending = parsed.item.value;
    else if (pending === "ActualText" && parsed.item?.kind === "str") {
      actual = decodePdfString(parsed.item.bytes);
      pending = "";
    } else pending = "";
  }
  return { index, item: { kind: "dict" as const, actual } };
}

function endString(source: string, start: number) {
  const bytes: number[] = [];
  let index = start + 1;
  let depth = 1;
  while (index < source.length && depth > 0) {
    const code = source.charCodeAt(index);
    if (code === 0x28) {
      depth += 1;
      bytes.push(code);
      index += 1;
      continue;
    }
    if (code === 0x29) {
      depth -= 1;
      if (depth === 0) break;
      bytes.push(code);
      index += 1;
      continue;
    }
    if (code !== 0x5c) {
      bytes.push(code);
      index += 1;
      continue;
    }
    index += 1;
    const next = source.charCodeAt(index);
    if (next >= 0x30 && next <= 0x37) {
      let octal = String.fromCharCode(next);
      index += 1;
      for (let extra = 0; extra < 2; extra += 1) {
        const digit = source.charCodeAt(index);
        if (digit < 0x30 || digit > 0x37) break;
        octal += String.fromCharCode(digit);
        index += 1;
      }
      bytes.push(parseInt(octal, 8));
      continue;
    }
    if (next === 0x0a || next === 0x0d) {
      if (next === 0x0d && source.charCodeAt(index + 1) === 0x0a) index += 1;
      index += 1;
      continue;
    }
    bytes.push(
      next === 0x6e
        ? 10
        : next === 0x72
          ? 13
          : next === 0x74
            ? 9
            : next === 0x62
              ? 8
              : next === 0x66
                ? 12
                : next,
    );
    index += 1;
  }
  return {
    index: Math.min(index + 1, source.length),
    bytes: Uint8Array.from(bytes),
  };
}

function endHex(source: string, start: number) {
  let index = start + 1;
  let hex = "";
  while (index < source.length && source[index] !== ">") {
    if (/[0-9A-Fa-f]/.test(source[index])) hex += source[index];
    index += 1;
  }
  if (hex.length % 2 === 1) hex += "0";
  const bytes = new Uint8Array(hex.length / 2);
  for (let pair = 0; pair < bytes.length; pair += 1)
    bytes[pair] = parseInt(hex.slice(pair * 2, pair * 2 + 2), 16);
  return { index: Math.min(index + 1, source.length), bytes };
}

function readName(source: string, start: number) {
  let index = start + 1;
  let value = "";
  while (index < source.length && !isDelimiter(source[index])) {
    value += source[index];
    index += 1;
  }
  return { index, value };
}

function asRawStream(value: unknown, pdfLib: typeof import("pdf-lib")) {
  return value instanceof pdfLib.PDFRawStream ? value : undefined;
}

function readNumber(source: string, start: number) {
  const match = /^[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)/.exec(source.slice(start));
  if (!match) return null;
  return { index: start + match[0].length, value: Number(match[0]) };
}

function readOperator(source: string, start: number) {
  const match = /^(?:[A-Za-z*]+|'|")/.exec(source.slice(start));
  if (!match) return null;
  if (match[0] === "BI") {
    const end = source.indexOf("EI", start + 2);
    return { index: end < 0 ? source.length : end + 2, value: "BI" };
  }
  return { index: start + match[0].length, value: match[0] };
}

function skipSpace(source: string, start: number) {
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === "%") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (" \t\r\n\f\0".includes(char)) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function isDelimiter(char: string) {
  return " \t\r\n\f\0()<>[]{}/%".includes(char);
}

function latin1(bytes: Uint8Array) {
  let out = "";
  for (let index = 0; index < bytes.length; index += 8192)
    out += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return out;
}

function decodeBytes(bytes: Uint8Array, font: FontDecode) {
  if (!font.map && looksLikeUtf16(bytes))
    return decodePdfString(bytes[0] === 0xfe ? bytes : pairedUtf16(bytes));
  if (!font.map) return winAnsi(bytes);
  let out = "";
  for (let index = 0; index + font.width <= bytes.length; index += font.width) {
    let code = 0;
    for (let byte = 0; byte < font.width; byte += 1)
      code = (code << 8) | bytes[index + byte];
    out +=
      font.map.get(code) ??
      (font.width === 1 ? winAnsi(bytes.subarray(index, index + 1)) : "");
  }
  return out;
}

function looksLikeUtf16(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes.length % 2 !== 0) return false;
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return true;
  let zeros = 0;
  for (let index = 0; index < bytes.length; index += 2)
    if (bytes[index] === 0) zeros += 1;
  return zeros > bytes.length / 4;
}

function pairedUtf16(bytes: Uint8Array) {
  const paired = new Uint8Array(bytes.length + 2);
  paired[0] = 0xfe;
  paired[1] = 0xff;
  paired.set(bytes, 2);
  return paired;
}

function decodePdfString(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let index = 2; index + 1 < bytes.length; index += 2)
      out += String.fromCodePoint((bytes[index] << 8) | bytes[index + 1]);
    return out;
  }
  return winAnsi(bytes);
}

function winAnsi(bytes: Uint8Array) {
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80 || byte >= 0xa0) out += String.fromCharCode(byte);
    else out += CP1252[byte] ?? "";
  }
  return out;
}

function parseCMap(text: string): FontDecode {
  const map = new Map<number, string>();
  const chars = /beginbfchar([\s\S]*?)endbfchar/g;
  for (const block of text.matchAll(chars)) {
    for (const pair of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    ))
      map.set(parseInt(pair[1], 16), unicodeHex(pair[2]));
  }
  const ranges = /beginbfrange([\s\S]*?)endbfrange/g;
  for (const block of text.matchAll(ranges)) {
    for (const range of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      const start = parseInt(range[1], 16);
      const end = Math.min(parseInt(range[2], 16), start + 5000);
      let code = parseInt(range[3], 16);
      for (let value = start; value <= end; value += 1, code += 1)
        map.set(value, String.fromCodePoint(code));
    }
    for (const range of block[1].matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g,
    )) {
      const start = parseInt(range[1], 16);
      const dest = [...range[3].matchAll(/<([0-9A-Fa-f]+)>/g)];
      dest.forEach((item, offset) =>
        map.set(start + offset, unicodeHex(item[1])),
      );
    }
  }
  let width: 1 | 2 = 1;
  for (const code of map.keys()) if (code > 0xff) width = 2;
  return { width, map };
}

function unicodeHex(hex: string) {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length <= 2) {
    const code = parseInt(clean, 16);
    return Number.isNaN(code) ? "" : String.fromCodePoint(code);
  }
  let out = "";
  for (let index = 0; index + 3 < clean.length; index += 4) {
    const code = parseInt(clean.slice(index, index + 4), 16);
    if (!Number.isNaN(code)) out += String.fromCodePoint(code);
  }
  return out;
}
