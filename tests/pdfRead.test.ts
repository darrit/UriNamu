import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { newPerson, normalize } from "../src/domain";
import { parseGenericFamily } from "../src/pdfText";
import { attachFamily } from "../src/pdfAttach";
import { readPdf, textFromContent } from "../src/pdfRead";

const person = (name: string, born = "", died = "") => ({
  ...newPerson(),
  id: name.toLocaleLowerCase().replace(/\s+/g, "-"),
  name,
  firstName: name.split(" ")[0] ?? name,
  lastName: name.split(" ").slice(1).join(" "),
  born,
  died,
});

describe("PDF text", () => {
  it("reads a dated line, a following date, and a marriage", () => {
    const parsed = parseGenericFamily(
      [
        "Testaa Testfamilie * 01.01.1963 in Testort",
        "Testar Testfamilie",
        "geboren 01.05.1960",
        "gestorben 2015",
        "Testaa Testfamilie verheiratet mit Testar Testfamilie am 12.08.1988",
        "Testbx Testfamilie * 02.03.1990",
        "Kind von Testaa Testfamilie und Testar Testfamilie",
        "Die Familie zog später in eine andere Stadt und blieb dort viele Jahre.",
      ].join("\n"),
      "Testfamilie",
    ).family;
    expect(parsed?.name).toBe("Testfamilie");
    const testaa = parsed?.members.find((item) => item.name === "Testaa Testfamilie");
    const testar = parsed?.members.find((item) => item.name === "Testar Testfamilie");
    const testbx = parsed?.members.find((item) => item.name === "Testbx Testfamilie");
    expect(testaa).toMatchObject({ born: "1963-01-01", place: "Testort" });
    expect(testar).toMatchObject({ born: "1960-05-01", died: "2015", bio: "" });
    expect(testbx?.parents).toEqual([testaa?.id, testar?.id]);
    expect(parsed?.unions[0]).toMatchObject({
      status: "active",
      marriage: "married",
      marriedOn: "1988-08-12",
    });
    expect(parsed?.members.some((item) => item.name.includes("Familie"))).toBe(false);
  });

  it("does not invent a day for a year and ignores a picture label", () => {
    const parsed = parseGenericFamily("UriNamu  1/1\nTestbk Testhaus * 1970", "Testhaus").family;
    expect(parsed?.members).toHaveLength(1);
    expect(parsed?.members[0]).toMatchObject({ born: "1970", bio: "", firstName: "Testbk" });
  });

  it("keeps an actual-text run and a hex string", () => {
    expect(textFromContent("BT /Span << /ActualText (Testaa Testfamilie) >> BDC EMC ET")).toBe("Testaa Testfamilie");
    expect(textFromContent("BT <54657374> Tj ET")).toBe("Test");
  });
});

describe("PDF file", () => {
  it("reads UriNamu data from the file and drops photos", async () => {
    const family = normalize({
      version: 2,
      name: "Testfamilie",
      members: [
        {
          ...person("Testaa Testfamilie", "1963-01-01"),
          photo: "data:image/png;base64,aaaa",
          bio: "Anonyme Testnotiz",
        },
      ],
      unions: [],
    });
    const pdf = await PDFDocument.create();
    pdf.addPage();
    await attachFamily(pdf, family);
    const bytes = await pdf.save();
    const read = await readPdf(bytes, "anders.pdf");
    expect(read.embedded?.name).toBe("Testfamilie");
    expect(read.embedded?.members[0]).toMatchObject({
      name: "Testaa Testfamilie",
      photo: "",
      bio: "Anonyme Testnotiz",
      born: "1963-01-01",
    });
    expect(read.embeddedBroken).toBe(false);
  });

  it("reads ordinary text when the file has no UriNamu data", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Testaa Testfamilie * 01.01.1963", { x: 50, y: 700, size: 12, font });
    const read = await readPdf(await pdf.save(), "Testfamilie.pdf");
    expect(read.embedded).toBeNull();
    expect(read.generic?.members.map((item) => item.name)).toEqual(["Testaa Testfamilie"]);
    expect(read.hasText).toBe(true);
  });

  it("falls back when the attached data cannot be read", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Testar Testfamilie * 01.05.1960", { x: 50, y: 700, size: 12, font });
    await pdf.attach(new TextEncoder().encode("{"), "urinamu-family.json", {
      mimeType: "application/json",
    });
    const read = await readPdf(await pdf.save(), "Testfamilie.pdf");
    expect(read.embedded).toBeNull();
    expect(read.embeddedBroken).toBe(true);
    expect(read.generic?.members[0].name).toBe("Testar Testfamilie");
  });

  it("treats a picture page as textless", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const read = await readPdf(await pdf.save(), "bild.pdf");
    expect(read.embedded).toBeNull();
    expect(read.generic).toBeNull();
    expect(read.hasText).toBe(false);
    expect(read.embeddedBroken).toBe(false);
  });
});
