import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parseFramedChart, type ChartBox } from "../src/pdfFramedChart";
import { type ChartItem, type ChartLine } from "../src/pdfChart";
import { readPdf } from "../src/pdfRead";
import { tidyLayout, positionsOverlap, gapKind } from "../src/layout";

// Entirely invented people and geometry: no private document fixture.
function fixture() {
  const boxes: ChartBox[] = [],
    items: ChartItem[] = [],
    lines: ChartLine[] = [];
  const person = (x: number, top: number, name: string) => {
    boxes.push({ left: x - 50, right: x + 50, top, bottom: top - 80 });
    items.push(
      { x: x - 20, y: top - 20, text: name },
      { x: x - 20, y: top - 40, text: "Example" },
      {
        x: x - 20,
        y: top - 60,
        text: top === 1000 ? "* 01.01.1950" : "* 01.01.1980",
      },
    );
  };
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push({ x1, y1, x2, y2 });
  person(100, 1000, "A");
  person(220, 1000, "B");
  person(500, 1000, "C");
  person(620, 1000, "D");
  person(100, 780, "E");
  person(220, 780, "F");
  person(500, 780, "G");
  person(1800, 780, "H");
  items.push(
    { x: 140, y: 900, text: "oo 01.01.1970" },
    { x: 540, y: 900, text: "oo LAG 1972" },
  );
  line(100, 890, 220, 890);
  line(500, 890, 620, 890);
  line(160, 890, 160, 805);
  line(100, 805, 220, 805);
  line(220, 805, 1800, 805);
  line(100, 805, 100, 786);
  line(1800, 805, 1800, 786);
  // Crosses the sibling bar without joining it.
  line(560, 890, 500, 786);
  return { boxes, items, lines };
}

describe("framed descendant charts", () => {
  it("traces distant siblings and crossing diagonals without attaching an unconnected spouse", () => {
    const { items, lines, boxes } = fixture();
    const family = parseFramedChart(items, lines, boxes, "Example")!;
    expect(family.members).toHaveLength(8);
    const byName = (name: string) =>
      family.members.find((p) => p.firstName === name)!;
    for (const name of ["E", "H"])
      expect(byName(name).parents).toEqual([byName("A").id, byName("B").id]);
    expect(byName("G").parents).toEqual([byName("C").id, byName("D").id]);
    expect(byName("F").parents).toEqual([]);
    expect(
      family.unions.find(
        (u) => u.a === byName("C").id || u.b === byName("C").id,
      )?.marriage,
    ).toBe("married");
    expect(byName("A").positions?.chart?.x).toBe(
      byName("E").positions?.chart?.x,
    );
  });
  it("imports framed PDF drawing operators with scale, translation, background and complete names", async () => {
    const { items, lines, boxes } = fixture();
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([2100, 1200]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 2100,
      height: 1200,
      color: rgb(1, 1, 0.7),
    });
    for (const box of boxes)
      page.drawRectangle({
        x: box.left,
        y: box.bottom,
        width: 100,
        height: 80,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
        color: rgb(1, 1, 1),
      });
    for (const line of lines)
      page.drawLine({
        start: { x: line.x1, y: line.y1 },
        end: { x: line.x2, y: line.y2 },
        thickness: 1,
      });
    for (const item of items)
      page.drawText(item.text, { x: item.x, y: item.y, size: 10, font });
    page.scaleContent(0.7, 0.7);
    page.translateContent(15, 20);
    const reading = await readPdf(await pdf.save(), "Example.pdf");
    expect(reading.layout).toBe("chart");
    expect(reading.generic?.members).toHaveLength(8);
    expect(
      reading.generic?.members.filter((p) => p.parents.length),
    ).toHaveLength(3);
    expect(
      reading.generic?.members.every(
        (p) =>
          p.lastName === "Example" &&
          ["1950-01-01", "1980-01-01"].includes(p.born),
      ),
    ).toBe(true);
  });
  it("keeps printed rows, column alignment, order and relationships when tidying repeatedly", () => {
    const { items, lines, boxes } = fixture();
    const family = parseFramedChart(items, lines, boxes, "Example")!;
    const tidy = tidyLayout(family, "chart");
    const twice = tidyLayout(tidy, "chart");
    expect(twice).toEqual(tidy);
    for (const p of tidy.members) {
      const old = family.members.find((q) => q.id === p.id)!;
      expect(p.parents).toEqual(old.parents);
      expect(p.positions?.chart?.y).toBe(old.positions?.chart?.y);
      for (const q of tidy.members.filter(
        (q) => q.id !== p.id && q.positions?.chart?.y === p.positions?.chart?.y,
      ))
        expect(
          positionsOverlap(
            p.positions!.chart!,
            q.positions!.chart!,
            "chart",
            gapKind(tidy, p.id, q.id),
          ),
        ).toBe(false);
    }
    const originalOrder = family.members.map((p) => p.id);
    expect(tidy.members.map((p) => p.id)).toEqual(originalOrder);
  });
});

it("keeps an explicitly drawn long diagonal and separates coincident chart seats", () => {
  const { items, boxes } = fixture();
  const family = parseFramedChart(
    items,
    [
      { x1: 100, y1: 890, x2: 220, y2: 890 },
      { x1: 160, y1: 890, x2: 1800, y2: 786 },
    ],
    boxes,
    "Example",
  )!;
  const a = family.members.find((p) => p.firstName === "A")!;
  const b = family.members.find((p) => p.firstName === "B")!;
  const child = family.members.find((p) => p.firstName === "H")!;
  expect(child.parents).toEqual([a.id, b.id]);
  b.positions!.chart = { ...a.positions!.chart! };
  const tidy = tidyLayout(family, "chart");
  const first = tidy.members.find((p) => p.id === a.id)!;
  const second = tidy.members.find((p) => p.id === b.id)!;
  expect(
    positionsOverlap(
      first.positions!.chart!,
      second.positions!.chart!,
      "chart",
    ),
  ).toBe(false);
});

it.each(["text", "strokes"])(
  "reads a separated wedding sign between person frames (%s)",
  (format) => {
    const { items, boxes, lines } = fixture();
    if (format === "text") items.push({ x: 160, y: 960, text: "=" });
    else
      lines.push(
        { x1: 149, y1: 958, x2: 171, y2: 958 },
        { x1: 149, y1: 963, x2: 171, y2: 963 },
      );
    const family = parseFramedChart(items, lines, boxes, "Example")!;
    expect(family.members).toHaveLength(8);
    expect(
      family.unions.find((u) => u.marriedOn === "1970-01-01"),
    ).toMatchObject({ status: "separated", marriage: "divorced" });
    expect(family.members.filter((p) => p.parents.length)).toHaveLength(3);
  },
);


it.each(['classic','horizontal','tapestry','chart'] as const)('tidies imported rows without moving unrelated people to another generation: %s',mode=>{
 const {items,lines,boxes}=fixture(); const f=parseFramedChart(items,lines,boxes,'Example')!;
 const tidy=tidyLayout(f,mode); expect(tidyLayout(tidy,mode)).toEqual(tidy);
 const cross=mode==='horizontal'?'x':'y';
 for(const p of tidy.members){expect(p.positions![mode]![cross]).toBe(f.members.find(q=>q.id===p.id)!.positions![mode]![cross]);for(const q of tidy.members)if(p.id!==q.id)expect(positionsOverlap(p.positions![mode]!,q.positions![mode]!,mode,gapKind(tidy,p.id,q.id))).toBe(false);}
});
