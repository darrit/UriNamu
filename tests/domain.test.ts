import { describe, it, expect } from "vitest";
import demo from "../src/demo.json";
import {
  normalize,
  validate,
  newPerson,
  updatePerson,
  assignMarriage,
  childBranchControl,
  removePerson,
  childrenOf,
  dynastyMembers,
  unionKey,
  displayName,
  matchesQuery,
  nameInputs,
  nameParts,
  setDeathDate,
  years,
} from "../src/domain";
import { layoutFamily } from "../src/layout";
const family = () => normalize(structuredClone(demo));
describe("Familienmodell", () => {
  it("prüft die vollständige Demo", () =>
    expect(() => validate(family())).not.toThrow());
  it("hält eine Dynastie auf den Nachkommen der Person", () => {
    const f = family();
    const testce = f.members.find((p) => p.id === "3")!;
    const testam = f.members.find((p) => p.id === "4")!;
    testce.dynasty = { name: "Testfamiliea", logo: "", corner: "right" };
    expect(new Set(dynastyMembers(f, testce))).toEqual(
      new Set(["3", "7", "8", "9", "11"]),
    );
    testam.dynastyWith = ["3"];
    expect(new Set(dynastyMembers(f, testce)).has("4")).toBe(true);
    testam.dynasty = { name: "Testfamilie", logo: "", corner: "left" };
    expect(new Set(dynastyMembers(f, testam))).toEqual(
      new Set(["4", "7", "8", "9", "11"]),
    );
    expect(dynastyMembers(f, testam)).not.toContain("3");
    f.members.push({ ...newPerson(), id: "12", name: "Testbb Testfamilie" });
    f.members.find((p) => p.id === "8")!.parents = ["12"];
    const withAncestor = new Set(dynastyMembers(f, testce));
    expect(withAncestor.has("12")).toBe(false);
    expect(withAncestor.has("8")).toBe(true);
    expect(() => validate(f)).not.toThrow();
    testce.dynasty = { name: " ", logo: "", corner: "left" };
    expect(() => validate(f)).toThrow();
  });
  it("legt eine Dynastie auch ohne Partner an", () => {
    const f = family();
    const testav = f.members.find((p) => p.id === "9")!;
    testav.dynasty = { name: "Testav", logo: "", corner: "left" };
    expect(dynastyMembers(f, testav)).toEqual(["9"]);
    expect(() => validate(f)).not.toThrow();
  });
  it("übernimmt eine ältere Paar-Dynastie auf eine Person", () => {
    const raw = family();
    raw.unions.find((u) => u.id === "3|4")!.dynasty = {
      name: "Testfamiliea",
      logo: "",
      corner: "right",
    };
    const f = normalize(raw);
    const host = f.members.find((p) => p.dynasty?.name === "Testfamiliea")!;
    const guest = f.members.find((p) => p.dynastyWith?.includes(host.id))!;
    expect(new Set([host.id, guest.id])).toEqual(new Set(["3", "4"]));
    expect(f.unions.every((u) => !u.dynasty)).toBe(true);
    expect(new Set(dynastyMembers(f, host))).toEqual(
      new Set(["3", "4", "7", "8", "9", "11"]),
    );
  });
  it("erkennt Zyklen und doppelte Eltern", () => {
    const f = family();
    f.members[0].parents = ["11"];
    expect(() => validate(f)).toThrow();
    const g = family();
    g.members[2].parents = ["1", "1"];
    expect(() => validate(g)).toThrow();
  });
  it("trennt Partnerschaften mit Kindern und erlaubt eine neue", () => {
    const f = family();
    f.unions.find((u) => u.id === "7|8")!.status = "separated";
    const p = { ...newPerson(), name: "Testac", born: "1990-01-01" };
    const n = updatePerson(f, p, "7");
    expect(n.unions.find((u) => u.id === "7|8")!.status).toBe("separated");
    expect(
      childrenOf(
        n,
        n.unions.find((u) => u.id === "7|8")!,
      ),
    ).toHaveLength(1);
    expect(n.unions.some((u) => u.id === unionKey(p.id, "7"))).toBe(true);
  });
  it("verhindert zwei gleichzeitige Partner", () => {
    expect(() =>
      updatePerson(family(), { ...newPerson(), name: "Test" }, "7"),
    ).toThrow();
  });
  it("entfernt nur die gewünschte Person und ihre direkten Verknüpfungen", () => {
    const f = removePerson(family(), "7");
    expect(f.members).toHaveLength(10);
    expect(f.members.find((p) => p.id === "11")!.parents).toEqual(["8"]);
    expect(() => validate(f)).not.toThrow();
  });
  it("entfernt auf Wunsch den ganzen nachfolgenden Baum", () => {
    const next = removePerson(family(), "7", true);
    expect(next.members.find((p) => p.id === "7")).toBeUndefined();
    expect(next.members.find((p) => p.id === "11")).toBeUndefined();
    expect(next.members.find((p) => p.id === "8")).toBeTruthy();
    expect(() => validate(next)).not.toThrow();
  });
  it("kann nicht kinderlos sein, wenn Kinder existieren", () => {
    const f = family();
    f.unions[0].ended = true;
    expect(() => validate(f)).toThrow();
  });
  it("erkennt unmögliche Kalenderdaten und Chronologie", () => {
    const f = family();
    f.members[0].born = "1932-02-30";
    expect(() => validate(f)).toThrow();
    f.members[0].born = "2020-01-01";
    expect(() => validate(f)).toThrow();
  });
});
describe("Stammbaum-Anordnung", () => {
  for (const mode of ["classic", "horizontal", "tapestry"] as const)
    it(mode + ": jede Person und freie Partnerplätze", () => {
      const s = layoutFamily(family(), mode, null);
      expect(Object.keys(s.positions)).toHaveLength(11);
      expect(s.slots).toHaveLength(3);
      expect(s.unions).toHaveLength(4);
      expect(
        Object.values(s.positions).every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
        ),
      ).toBe(true);
    });
  it("behält Kartenpositionen und Pfade beim Wechsel des Mittelpunkts bei", () => {
    const f = family(),
      a = layoutFamily(f, "classic", "7"),
      b = layoutFamily(f, "classic", "9");
    expect(a.positions).toEqual(b.positions);
    expect(a.unions).toEqual(b.unions);
    expect(a.positions["3"].y).toBeLessThan(a.positions["7"].y);
    expect(a.positions["11"].y).toBeGreaterThan(a.positions["7"].y);
  });
  it("behält eine geschiedene Verbindung auch ohne Kinder sichtbar", () => {
    const f = family();
    f.members = f.members.filter((p) => p.id !== "11");
    f.unions.find((u) => u.id === "7|8")!.status = "separated";
    const s = layoutFamily(f, "classic", null);
    expect(s.unions.find((u) => u.id === "7|8")?.separated).toBe(true);
    expect(s.slots.some((p) => p.id === "7")).toBe(true);
  });
});

describe("Familienstand", () => {
  it("setzt verheiratet, sobald eine Partnerschaft verbunden ist", () => {
    const person = { ...newPerson(), name: "Neu", born: "1991-01-01" };
    const next = updatePerson(family(), person, "9");
    const union = next.unions.find((item) => item.id === unionKey(person.id, "9"))!;
    expect(union.status).toBe("active");
    expect(union.marriage).toBe("married");
    expect(next.unions.find((item) => item.id === "3|4")!.marriage).toBe(
      "married",
    );
  });
  it("setzt geschieden, wenn die Linie wegen Scheidung durchgestrichen ist", () => {
    const source = family();
    const union = source.unions.find((item) => item.id === "7|8")!;
    union.marriage = "married";
    const next = updatePerson(
      source,
      source.members.find((person) => person.id === "7")!,
      "9",
    );
    expect(next.unions.find((item) => item.id === "7|8")!.marriage).toBe(
      "divorced",
    );
    expect(next.unions.find((item) => item.id === "7|9")!.marriage).toBe(
      "married",
    );
  });
  it("behält eine verbundene Ehe und macht aus einer durchgestrichenen Ehe eine Scheidung", () => {
    const married = family().unions[0];
    married.marriage = "unspecified";
    assignMarriage(married);
    expect(married.marriage).toBe("married");
    married.status = "separated";
    assignMarriage(married);
    expect(married.marriage).toBe("divorced");
  });
  it("lässt ein getrenntes Paar ohne Ehe unbestimmt", () => {
    const separated = family().unions[0];
    separated.status = "separated";
    separated.marriage = "unspecified";
    assignMarriage(separated);
    expect(separated.marriage).toBe("unspecified");
  });
  it("zeigt das Plus nur, solange Kinder noch offen sind", () => {
    const tree = family();
    const parents = tree.unions.find((union) => union.id === "1|2")!;
    const childless = tree.unions.find((union) => union.id === "5|6")!;
    expect(childBranchControl(tree, parents)).toBe("hidden");
    childless.marriage = "married";
    tree.members.forEach((person) => {
      person.parents = person.parents.filter((id) => id !== "5" && id !== "6");
    });
    expect(childBranchControl(tree, childless)).toBe("plus");
    childless.ended = true;
    expect(childBranchControl(tree, childless)).toBe("ended");
    childless.ended = false;
    childless.childPrompt = false;
    expect(childBranchControl(tree, childless)).toBe("hidden");
    childless.childPrompt = true;
    childless.marriage = "divorced";
    childless.status = "separated";
    expect(childBranchControl(tree, childless)).toBe("hidden");
  });
});

describe("Geburtsnamen", () => {
  it("zeigt den optionalen Geburtsnamen zwischen Vor- und Nachnamen", () => {
    const p = {
      ...newPerson(),
      name: "Testae Testbr von Testfamilie",
      firstName: "Testae Testbr",
      lastName: "von Testfamilie",
      birthName: "Testgebürtig",
    };
    expect(displayName(p)).toBe("Testae Testbr (Testgebürtig) von Testfamilie");
    expect(displayName({ ...p, birthName: "  " })).toBe(p.name);
    expect(matchesQuery(p, "")).toBe(true);
    expect(matchesQuery(p, "testgebürtig")).toBe(true);
    expect(matchesQuery(p, "Andere Testperson")).toBe(false);
    expect(nameParts({ name: "Testae Testfamilie" })).toEqual({
      firstName: "Testae",
      lastName: "Testfamilie",
    });
    expect(
      nameInputs({ name: "Testae Testbr Testfamilie", firstName: "", lastName: "" }),
    ).toEqual({ firstName: "Testae Testbr", lastName: "Testfamilie" });
    expect(
      nameInputs({ name: "Testae", firstName: "Testae ", lastName: "" }),
    ).toEqual({ firstName: "Testae ", lastName: "" });
    expect(
      nameInputs({
        name: "Testae Testbr von Testfamilie",
        firstName: "Testae Testbr",
        lastName: "von Testfamilie",
      }),
    ).toEqual({ firstName: "Testae Testbr", lastName: "von Testfamilie" });
  });
  it("speichert mehrere Vornamen und entfernt nur Leerzeichen am Rand", () => {
    const p = {
      ...newPerson(),
      name: "Testae",
      firstName: "Testae Testbr ",
      lastName: " von Testfamilie",
    };
    const saved = updatePerson(family(), p, "").members.find(
      (member) => member.id === p.id,
    )!;
    expect(saved.firstName).toBe("Testae Testbr");
    expect(saved.lastName).toBe("von Testfamilie");
    expect(saved.name).toBe("Testae Testbr von Testfamilie");
  });
  it("liest alte Profile ohne neue Namensfelder weiterhin ein", () => {
    const f = family();
    expect(displayName(f.members[0])).toBe(f.members[0].name);
    f.members[0].birthName = "Testgebürtig";
    expect(() => validate(f)).not.toThrow();
    expect(normalize(f).members[0].birthName).toBe("Testgebürtig");
  });
});

describe("Sterbedatum", () => {
  it("erfasst das Sterbedatum ohne Beziehungen oder das Original zu ändern", () => {
    const before = family();
    const next = setDeathDate(before, "7", "2020-07-15");
    expect(next.members.find((p) => p.id === "7")!.died).toBe("2020-07-15");
    expect(years(next.members.find((p) => p.id === "7")!)).toContain(
      "† 15.07.2020",
    );
    expect(before.members.find((p) => p.id === "7")!.died).toBe("");
    expect(next.unions).toEqual(before.unions);
    expect(next.members.find((p) => p.id === "11")!.parents).toEqual(
      before.members.find((p) => p.id === "11")!.parents,
    );
    expect(
      setDeathDate(next, "7", "").members.find((p) => p.id === "7")!.died,
    ).toBe("");
  });
  it("lehnt unmögliche Sterbedaten, Daten vor Geburt und unbekannte Personen ab", () => {
    expect(() => setDeathDate(family(), "7", "2020-02-30")).toThrow();
    expect(() => setDeathDate(family(), "7", "1800-01-01")).toThrow();
    expect(() =>
      setDeathDate(family(), "nicht-vorhanden", "2020-01-01"),
    ).toThrow();
  });
});

it("keeps family branches in ancestral order rather than crossing alphabetically", () => {
  const s = layoutFamily(family(), "classic", null);
  expect(s.positions["7"].x).toBeLessThan(s.positions["10"].x);
  expect(s.positions["9"].x).toBeLessThan(s.positions["10"].x);
});
