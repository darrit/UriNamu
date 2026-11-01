import { describe, expect, it } from "vitest";
import { parseChart, type ChartItem } from "../src/pdfChart";

function item(x: number, y: number, text: string): ChartItem {
  return { x, y, text };
}

describe("Tafel", () => {
  it("liest das oberste Paar und das Kind darunter", () => {
    const family = parseChart(
      [
        item(0, 1100, "Tafel Beispiel"),
        item(100, 1000, "Testbb"),
        item(220, 1000, "Testaz"),
        item(100, 880, "Testzweig"),
        item(220, 880, "Testfamilie"),
        item(100, 760, "* 01.02.1900"),
        item(220, 760, "* 03.04.1902"),
        item(160, 640, "oo 05.06.1920"),
        item(90, 200, "Testbn"),
        item(180, 200, "Testbe"),
        item(90, 80, "Testzweig"),
        item(180, 80, "Testlinie"),
        item(90, -40, "* 07.08.1930"),
        item(140, -160, "oo ..."),
      ],
      "Beispiel",
    );
    const testbb = family?.members.find((person) => person.firstName === "Testbb");
    const testaz = family?.members.find((person) => person.firstName === "Testaz");
    const testbn = family?.members.find((person) => person.firstName === "Testbn");
    expect(family?.name).toBe("Beispiel");
    expect(testbb).toMatchObject({ lastName: "Testzweig", born: "1900-02-01" });
    expect(testaz).toMatchObject({ born: "1902-04-03" });
    expect(testbn?.parents).toEqual([testbb?.id, testaz?.id]);
    expect(family?.unions.some((union) => union.marriedOn === "1920-06-05")).toBe(true);
    expect(family?.members.find((person) => person.firstName === "Testbe")?.parents).toEqual([]);
  });

  it("nimmt die neueste Ehe, ein Minus und die Kinder unter der Linie", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(500, 1000, "Testam"),
        item(100, 880, "Alt"),
        item(300, 880, "Mitte"),
        item(500, 880, "Neu"),
        item(200, 640, "oo 01.01.1920"),
        item(400, 640, "oo 01.01.1940"),
        item(100, 200, "Testao"),
        item(220, 200, "Testau"),
        item(100, 80, "Alt"),
        item(220, 80, "Testlinie"),
        item(160, -40, "-"),
        item(700, 1000, "..."),
        item(700, 880, "..."),
        item(700, 760, "+ ..."),
        item(900, 1000, "Testaw"),
        item(1040, 1000, "Testax"),
        item(900, 880, "Alt"),
        item(1040, 880, "Jung"),
        item(970, 640, "-"),
      ],
      "Beispiel",
      [{ x1: 100, y1: 500, x2: 100, y2: 200 }],
    );
    const testab = family?.members.find((person) => person.firstName === "Testab");
    const testaj = family?.members.find((person) => person.firstName === "Testaj");
    const testam = family?.members.find((person) => person.firstName === "Testam");
    const testao = family?.members.find((person) => person.firstName === "Testao");
    const testau = family?.members.find((person) => person.firstName === "Testau");
    const unknown = family?.members.find((person) => person.firstName === "...");
    const testaw = family?.members.find((person) => person.firstName === "Testaw");
    const testax = family?.members.find((person) => person.firstName === "Testax");
    const current = family?.unions.find((union) => union.a === testaj?.id && union.b === testam?.id || union.a === testam?.id && union.b === testaj?.id);
    const earlier = family?.unions.find((union) => union.a === testab?.id && union.b === testaj?.id || union.a === testaj?.id && union.b === testab?.id);
    const unmarried = family?.unions.find((union) => union.a === testao?.id && union.b === testau?.id || union.a === testau?.id && union.b === testao?.id);
    const former = family?.unions.find((union) => union.a === testaw?.id && union.b === testax?.id || union.a === testax?.id && union.b === testaw?.id);
    expect(current).toMatchObject({ status: "active", marriage: "married", marriedOn: "1940-01-01" });
    expect(earlier).toMatchObject({ status: "separated", marriage: "divorced" });
    expect(unmarried).toMatchObject({ status: "active", marriage: "unspecified" });
    expect(former).toMatchObject({ status: "active", marriage: "unspecified" });
    expect(testao?.parents).toEqual([testab?.id, testaj?.id]);
    expect(testau?.parents).toEqual([]);
    expect(testau?.lastName).toBe("Testlinie");
    expect(unknown).toMatchObject({ died: "", deceased: true, lastName: "" });
  });

  it("erkennt das Minus neben einer früheren Ehe als aktuelle Partnerschaft", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(500, 1000, "Testam"),
        item(100, 880, "Alt"),
        item(300, 880, "Mitte"),
        item(500, 880, "Neu"),
        item(200, 640, "oo 01.01.1940"),
        item(400, 640, "-"),
      ],
      "Beispiel",
    );
    const testab = family?.members.find((person) => person.firstName === "Testab");
    const testaj = family?.members.find((person) => person.firstName === "Testaj");
    const testam = family?.members.find((person) => person.firstName === "Testam");
    const marriage = family?.unions.find((union) => [union.a, union.b].includes(testab?.id ?? "") && [union.a, union.b].includes(testaj?.id ?? ""));
    const dash = family?.unions.find((union) => [union.a, union.b].includes(testaj?.id ?? "") && [union.a, union.b].includes(testam?.id ?? ""));
    expect(marriage).toMatchObject({ status: "separated", marriage: "divorced" });
    expect(dash).toMatchObject({ status: "active", marriage: "unspecified" });
  });

  it("liest ein Gleichheitszeichen als früheren Partner ohne Ehe", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(500, 1000, "Testam"),
        item(100, 880, "Alt"),
        item(300, 880, "Mitte"),
        item(500, 880, "Neu"),
        item(200, 640, "="),
        item(400, 640, "oo 01.01.1940"),
        item(800, 1000, "Testao"),
        item(980, 1000, "Testau"),
        item(800, 880, "Solo"),
        item(980, 880, "Solo"),
        item(890, 640, "="),
      ],
      "Beispiel",
    );
    const testab = family?.members.find((person) => person.firstName === "Testab");
    const testaj = family?.members.find((person) => person.firstName === "Testaj");
    const testam = family?.members.find((person) => person.firstName === "Testam");
    const testao = family?.members.find((person) => person.firstName === "Testao");
    const testau = family?.members.find((person) => person.firstName === "Testau");
    const earlier = family?.unions.find((union) => [union.a, union.b].includes(testab?.id ?? "") && [union.a, union.b].includes(testaj?.id ?? ""));
    const marriage = family?.unions.find((union) => [union.a, union.b].includes(testaj?.id ?? "") && [union.a, union.b].includes(testam?.id ?? ""));
    const only = family?.unions.find((union) => [union.a, union.b].includes(testao?.id ?? "") && [union.a, union.b].includes(testau?.id ?? ""));
    expect(earlier).toMatchObject({ status: "separated", marriage: "unspecified" });
    expect(marriage).toMatchObject({ status: "active", marriage: "married", marriedOn: "1940-01-01" });
    expect(only).toMatchObject({ status: "separated", marriage: "unspecified" });
  });

  it("gibt jedes Kind der Linie seines Paares", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(900, 1000, "Carl"),
        item(1100, 1000, "Testap"),
        item(100, 880, "Alt"),
        item(300, 880, "Alt"),
        item(900, 880, "Neu"),
        item(1100, 880, "Neu"),
        item(200, 640, "oo 01.01.1920"),
        item(1000, 640, "oo 01.01.1921"),
        item(40, 200, "Links"),
        item(260, 200, "Kind"),
        item(860, 200, "Rechts"),
        item(1120, 200, "Fremd"),
        item(40, 80, "Wolf"),
        item(260, 80, "Alt"),
        item(860, 80, "Neu"),
        item(1120, 80, "Fuchs"),
      ],
      "Beispiel",
      [
        { x1: 200, y1: 520, x2: 200, y2: 280 },
        { x1: 1000, y1: 520, x2: 1000, y2: 280 },
        { x1: 200, y1: 280, x2: 260, y2: 280 },
        { x1: 860, y1: 280, x2: 1000, y2: 280 },
        { x1: 200, y1: 280, x2: 1120, y2: 280 },
      ],
    );
    const testab = family?.members.find((person) => person.firstName === "Testab");
    const testaj = family?.members.find((person) => person.firstName === "Testaj");
    const carl = family?.members.find((person) => person.firstName === "Carl");
    const testap = family?.members.find((person) => person.firstName === "Testap");
    const kind = family?.members.find((person) => person.firstName === "Kind");
    const rechts = family?.members.find((person) => person.firstName === "Rechts");
    const links = family?.members.find((person) => person.firstName === "Links");
    const fremd = family?.members.find((person) => person.firstName === "Fremd");
    expect(kind?.parents).toEqual([testab?.id, testaj?.id]);
    expect(rechts?.parents).toEqual([carl?.id, testap?.id]);
    expect(links?.parents).toEqual([]);
    expect(fremd?.parents).toEqual([]);
  });

  it("hängt jedes Geschwister an den Strich unter der Querleiste", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(100, 880, "Alt"),
        item(300, 880, "Alt"),
        item(200, 640, "oo 01.01.1920"),
        item(80, 200, "Testae"),
        item(200, 200, "Testai"),
        item(360, 200, "Testal"),
        item(700, 200, "Fremd"),
        item(80, 80, "Alt"),
        item(200, 80, "Alt"),
        item(360, 80, "Alt"),
        item(700, 80, "Fuchs"),
      ],
      "Beispiel",
      [
        { x1: 200, y1: 520, x2: 200, y2: 280 },
        { x1: 80, y1: 300, x2: 360, y2: 300 },
        { x1: 80, y1: 300, x2: 80, y2: 210 },
        { x1: 200, y1: 300, x2: 200, y2: 210 },
        { x1: 360, y1: 300, x2: 360, y2: 210 },
      ],
    );
    const parents = ["Testab", "Testaj"].map((name) => family?.members.find((person) => person.firstName === name)?.id);
    for (const name of ["Testae", "Testai", "Testal"])
      expect(family?.members.find((person) => person.firstName === name)?.parents).toEqual(parents);
    expect(family?.members.find((person) => person.firstName === "Fremd")?.parents).toEqual([]);
  });

  it("folgt einer schrägen Linie zum Kind", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testab"),
        item(300, 1000, "Testaj"),
        item(100, 880, "Alt"),
        item(300, 880, "Alt"),
        item(200, 640, "oo 01.01.1920"),
        item(200, 200, "Testkind"),
        item(800, 200, "Testbe"),
        item(200, 80, "Alt"),
        item(800, 80, "Alt"),
      ],
      "Beispiel",
      [{ x1: 200, y1: 500, x2: 800, y2: 240 }],
    );
    const parents = ["Testab", "Testaj"].map((name) => family?.members.find((person) => person.firstName === name)?.id);
    expect(family?.members.find((person) => person.firstName === "Testbe")?.parents).toEqual(parents);
    expect(family?.members.find((person) => person.firstName === "Testkind")?.parents).toEqual([]);
  });

  it("teilt einen Schrägstrich in Geburtsname und Heiratsnamen", () => {
    const family = parseChart(
      [
        item(100, 1000, "Testae"),
        item(400, 1000, "Testai"),
        item(100, 880, "Testce / Testfrühname / Teststamm"),
        item(400, 880, "Alt"),
        item(250, 700, "oo 01.01.1920"),
        item(100, 200, "Testal"),
        item(100, 80, "Teststamm"),
      ],
      "Beispiel",
    );
    const testae = family?.members.find((person) => person.firstName === "Testae");
    expect(testae).toMatchObject({
      birthName: "Testce",
      lastName: "Teststamm",
      marriageNames: ["Testfrühname", "Teststamm"],
      name: "Testae Teststamm",
    });
    expect(testae?.positions?.chart?.y).toBe(0);
    expect(family?.members.find((person) => person.firstName === "Testal")?.positions?.chart?.y).toBeGreaterThan(0);
  });

});


describe('combined partnership symbols', () => {
  it.each(['oo LAG 1987', 'oo 1987', 'oo 26.02....'])('keeps marriage identity for %s and combines the separation sign', marker => {
    const items = [item(100,1000,'Testae'),item(300,1000,'Testai'),item(100,880,'Alpha'),item(300,880,'Beta'),item(100,800,'* 1960'),item(300,800,'* 26.02....'),item(200,640,marker)];
    for (const separated of [false, true]) {
      const f = parseChart([...items, ...(separated ? [item(200,760,'=')] : [])], 'Example')!;
      expect(f.unions[0].marriage).toBe(separated ? 'divorced' : 'married');
      expect(f.unions[0].status).toBe(separated ? 'separated' : 'active');
      expect(f.unions[0].marriedOn).toBe(marker.includes('1987') ? '1987' : undefined);
      expect(f.members.find(p=>p.firstName==='Testae')!.born).toBe('1960');
      expect(f.members.find(p=>p.firstName==='Testai')!.born).toBe('');
    }
  });
  const people = [
    item(100,1000,'Testab'),item(300,1000,'Testaj'),item(500,1000,'Testam'),
    item(100,880,'Alpha'),item(300,880,'Beta'),item(500,880,'Gamma'),
  ];
  it.each([
    { signs: [item(200,760,'=')], states: ['divorced','married'] },
    { signs: [item(200,760,'='),item(400,760,'=')], states: ['divorced','divorced'] },
    { signs: [item(400,760,'=')], states: ['divorced','divorced'] },
  ])('combines signs with wedding dates without reactivating an older marriage: $states', ({signs,states}) => {
    for(const reverse of [false,true]) {
      const items=[...people,item(200,640,'oo 01.01.1970'),item(400,640,'oo 01.01.1990'),...signs];
      const family=parseChart(reverse?items.reverse():items,'Example')!;
      expect(family.members).toHaveLength(3);
      expect(family.unions).toHaveLength(2);
      const unions=[...family.unions].sort((a,b)=>a.marriedOn!.localeCompare(b.marriedOn!));
      expect(unions.map(u=>u.marriage)).toEqual(states);
      expect(unions.map(u=>u.marriedOn)).toEqual(['1970-01-01','1990-01-01']);
      expect(unions.map(u=>u.status)).toEqual(states.map(s=>s==='married'?'active':'separated'));
    }
  });
  it('keeps a divorced wedding and a new unmarried partner distinct',()=>{
    const family=parseChart([...people,item(200,760,'='),item(200,640,'oo 01.01.1970'),item(400,760,'-')],'Example')!;
    expect(family.unions.find(u=>u.marriedOn)).toMatchObject({marriage:'divorced',status:'separated',marriedOn:'1970-01-01'});
    expect(family.unions.find(u=>!u.marriedOn)).toMatchObject({marriage:'unspecified',status:'active'});
  });
  it('reads an equals sign beside the name without creating a person',()=>{
    const family=parseChart([...people,item(200,1000,'='),item(200,640,'oo 01.01.1970')],'Example')!;
    expect(family.members).toHaveLength(3);
    expect(family.unions[0]).toMatchObject({marriage:'divorced',marriedOn:'1970-01-01'});
  });
});
