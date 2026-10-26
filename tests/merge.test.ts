import { describe, it, expect } from "vitest";
import {
  newPerson,
  unionKey,
  validate,
  type Family,
  type Person,
} from "../src/domain";
import { mergeFamilies, type MergeOptions, eligibleUnions } from "../src/merge";
function person(id: string, name: string, parents: string[] = []): Person {
  return { ...newPerson(), id, name, parents };
}
function fixture() {
  const left: Family = {
    version: 2,
    name: "Mutterseite",
    members: [
      person("mother", "Mutter", ["gm", "gf"]),
      person("father", "Vater"),
      person("gm", "Oma"),
      person("gf", "Opa"),
      person("kid", "Kind", ["mother", "father"]),
    ],
    unions: [
      {
        id: unionKey("mother", "father"),
        a: "mother",
        b: "father",
        marriage: "married",
        status: "active",
        ended: false,
      },
      {
        id: unionKey("gm", "gf"),
        a: "gm",
        b: "gf",
        status: "active",
        ended: false,
      },
    ],
  };
  const right: Family = {
    version: 2,
    name: "Vaterseite",
    members: [
      person("m2", "Mama"),
      person("f2", "Papa", ["gm2", "gf2"]),
      person("gm2", "Andere Oma"),
      person("gf2", "Anderer Opa"),
      person("kid2", "Dasselbe Kind", ["m2", "f2"]),
    ],
    unions: [
      {
        id: unionKey("m2", "f2"),
        a: "m2",
        b: "f2",
        marriage: "married",
        status: "active",
        ended: false,
      },
      {
        id: unionKey("gm2", "gf2"),
        a: "gm2",
        b: "gf2",
        status: "active",
        ended: false,
      },
    ],
  };
  const options: MergeOptions = {
    leftUnion: unionKey("mother", "father"),
    rightUnion: unionKey("m2", "f2"),
    swap: false,
    name: "Gemeinsamer Baum",
    marriage: "married",
    parentPolicy: "combine",
    relationshipPolicy: "reject",
    matches: {},
    fieldChoices: {
      mother: { name: "left" },
      father: { name: "left" },
    },
  };
  return { left, right, options };
}
describe("Zusammenführen", () => {
  it("ergänzt beide Vorfahrenseiten und lässt beide Originale unverändert", () => {
    const { left, right, options } = fixture(),
      snapshot = JSON.stringify({ left, right });
    const result = mergeFamilies(left, right, options);
    expect(result.members).toHaveLength(8);
    expect(result.members.find((p) => p.id === "mother")!.parents).toEqual([
      "gm",
      "gf",
    ]);
    expect(result.members.find((p) => p.id === "father")!.parents).toHaveLength(
      2,
    );
    expect(result.unions).toHaveLength(3);
    expect(JSON.stringify({ left, right })).toBe(snapshot);
    expect(() => validate(result)).not.toThrow();
  });
  it("gleicht dasselbe Kind nur nach ausdrücklicher Zuordnung ab", () => {
    const { left, right, options } = fixture();
    options.matches = { kid2: "kid" };
    options.fieldChoices = { ...options.fieldChoices, kid: { name: "left" } };
    const result = mergeFamilies(left, right, options);
    expect(result.members).toHaveLength(7);
    expect(result.members.find((p) => p.id === "kid")!.parents.sort()).toEqual([
      "father",
      "mother",
    ]);
  });
  it("unterstützt vertauschte Paarreihenfolge", () => {
    const { left, right, options } = fixture();
    right.unions[0].a = "f2";
    right.unions[0].b = "m2";
    options.swap = true;
    const result = mergeFamilies(left, right, options);
    expect(result.members.find((p) => p.id === "father")!.parents).toHaveLength(
      2,
    );
  });
  it("benötigt eine bestätigte Ehe in beiden Bäumen", () => {
    const { left, right, options } = fixture();
    delete right.unions[0].marriage;
    expect(eligibleUnions(right)).toHaveLength(0);
    expect(() => mergeFamilies(left, right, options)).toThrow(
      "verheiratete oder geschiedene",
    );
  });
  it("unterstützt geschiedene Paare mit gemeinsamen Kindern", () => {
    const { left, right, options } = fixture();
    for (const f of [left, right]) {
      f.unions[0].status = "separated";
      f.unions[0].marriage = "divorced";
    }
    options.marriage = "divorced";
    const r = mergeFamilies(left, right, options);
    expect(r.unions[0].status).toBe("separated");
    expect(r.unions[0].marriage).toBe("divorced");
  });
  it("bestätigt den Ergebnis-Familienstand ausdrücklich", () => {
    const { left, right, options } = fixture();
    options.marriage = "";
    expect(() => mergeFamilies(left, right, options)).toThrow("bestätigen");
  });
  it("verhindert mehrfache Personenzuordnungen", () => {
    const { left, right, options } = fixture();
    options.matches = { kid2: "mother" };
    expect(() => mergeFamilies(left, right, options)).toThrow("nur einer");
  });
  it("übernimmt kollidierende fremde IDs als unabhängige Personen", () => {
    const { left, right, options } = fixture();
    right.members[2].id = "gm";
    right.members[1].parents[0] = "gm";
    right.unions[1].a = "gm";
    right.unions[1].id = unionKey("gm", "gf2");
    const r = mergeFamilies(left, right, options);
    expect(r.members.filter((p) => p.id === "gm")).toHaveLength(1);
    expect(r.members.filter((p) => p.name.includes("Oma"))).toHaveLength(2);
  });
  it("integriert die Angehörigen des zweiten Baums auch bei gewählter Konfliktquelle", () => {
    const { left, right, options } = fixture();
    const brother = person("extra", "Bruder", ["m2", "f2"]);
    brother.positions = { tapestry: { x: 8000, y: 8000 } };
    right.members.push(brother);
    left.members[1].positions = { tapestry: { x: 9000, y: 9000 } };
    options.parentPolicy = "left";
    options.relationshipPolicy = "left";
    const result = mergeFamilies(left, right, options);
    const father = result.members.find((p) => p.id === "father")!;
    const grandma = result.members.find((p) => p.name === "Andere Oma")!;
    expect(father.name).toBe("Vater");
    expect(father.parents).toContain(grandma.id);
    const kept = result.members.find((p) => p.name === "Bruder")!;
    expect(kept.parents.sort()).toEqual(["father", "mother"]);
    expect(result.members.find((p) => p.name === "Kind")).toBeTruthy();
    expect(result.members.find((p) => p.name === "Andere Oma")).toBeTruthy();
    expect(father.positions?.tapestry?.x).not.toBe(9000);
    expect(kept.positions?.tapestry).toBeTruthy();
    expect(kept.positions?.tapestry?.x).not.toBe(8000);
  });
  it("erkennt Elternkonflikte und erlaubt eine explizite Quelle", () => {
    const { left, right, options } = fixture();
    right.members[0].parents = ["gm2", "gf2"];
    expect(() => mergeFamilies(left, right, options)).toThrow("mehr als zwei");
    options.parentPolicy = "left";
    expect(() => mergeFamilies(left, right, options)).not.toThrow();
  });
  it("ergänzt leere Profilfelder und verlangt eine Entscheidung bei Widerspruch", () => {
    const { left, right, options } = fixture();
    left.members[0].bio = "";
    right.members[0].bio = "Erinnerung";
    right.members[0].place = "Testorte";
    delete options.fieldChoices!.mother!.name;
    expect(() => mergeFamilies(left, right, options)).toThrow(
      "unterschiedliche Angaben",
    );
    options.fieldChoices!.mother!.name = "right";
    const chosen = mergeFamilies(left, right, options);
    expect(chosen.members.find((p) => p.id === "mother")!.name).toBe("Mama");
    expect(chosen.members.find((p) => p.id === "mother")!.bio).toBe(
      "Erinnerung",
    );
    expect(chosen.members.find((p) => p.id === "mother")!.place).toBe(
      "Testorte",
    );
    options.fieldChoices!.mother!.name = "left";
    const kept = mergeFamilies(left, right, options);
    expect(kept.members.find((p) => p.id === "mother")!.name).toBe("Mutter");
    expect(kept.members.find((p) => p.id === "mother")!.bio).toBe(
      "Erinnerung",
    );
  });
  it("ordnet dasselbe Paar über den Namen zu, auch wenn die Reihenfolge vertauscht ist", () => {
    const { options } = fixture();
    const left: Family = {
      version: 2,
      name: "Erster",
      members: [
        person("testaf", "Testaf Testfamilie", ["vater"]),
        person("testbt", "Testbt Testfamilie"),
        person("vater", "Vater Testfamilie"),
        person("testbq", "Testbq Testfamilie", ["testaf", "testbt"]),
      ],
      unions: [
        {
          id: unionKey("testaf", "testbt"),
          a: "testaf",
          b: "testbt",
          marriage: "married",
          status: "active",
          ended: false,
        },
      ],
    };
    const testbq = person("testbq2", "Testbq Testfamilie", ["testbt2", "testaf2"]);
    testbq.place = "Testort";
    const right: Family = {
      version: 2,
      name: "Zweiter",
      members: [
        person("testbt2", "Testbt Testfamilie", ["mutter"]),
        person("testaf2", "Testaf Testfamilie"),
        person("mutter", "Mutter Testfamilie"),
        testbq,
        person("testcb", "Testcb Testfamilie", ["testbt2", "testaf2"]),
      ],
      unions: [
        {
          id: unionKey("testbt2", "testaf2"),
          a: "testbt2",
          b: "testaf2",
          marriage: "married",
          status: "active",
          ended: false,
        },
      ],
    };
    options.swap = false;
    options.leftUnion = left.unions[0].id;
    options.rightUnion = right.unions[0].id;
    options.fieldChoices = {};
    const result = mergeFamilies(left, right, options);
    expect(result.members.filter((p) => p.name === "Testaf Testfamilie")).toHaveLength(
      1,
    );
    expect(result.members.filter((p) => p.name === "Testbt Testfamilie")).toHaveLength(1);
    const testaf = result.members.find((p) => p.id === "testaf")!;
    const testbt = result.members.find((p) => p.id === "testbt")!;
    expect(testaf.parents).toEqual(["vater"]);
    expect(testbt.parents).toEqual([
      result.members.find((p) => p.name === "Mutter Testfamilie")!.id,
    ]);
    const child = result.members.find((p) => p.id === "testbq")!;
    expect(child.place).toBe("Testort");
    expect(
      result.members.find((p) => p.name === "Testcb Testfamilie")!.parents.sort(),
    ).toEqual(["testaf", "testbt"]);
    expect(result.members).toHaveLength(6);
  });
  it("verhindert durch einen Abgleich neu entstehende Abstammungskreise", () => {
    const { left, right, options } = fixture();
    options.matches = { gm2: "kid" };
    options.fieldChoices = { ...options.fieldChoices, kid: { name: "left" } };
    expect(() => mergeFamilies(left, right, options)).toThrow(
      "Zusammenführung nicht möglich",
    );
  });
});
