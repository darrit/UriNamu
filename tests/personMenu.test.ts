import { afterEach, describe, expect, it, vi } from "vitest";
import { newPerson, type Family } from "../src/domain";
import { setLocale, t } from "../src/i18n";
import { personMenuItems } from "../src/tree/personMenuItems";

afterEach(() => setLocale("de"));

function fixture() {
  const person = { ...newPerson(), id: "a", name: "Person A" };
  const partner = { ...newPerson(), id: "b", name: "Person B" };
  const family: Family = {
    version: 2,
    name: "Test",
    members: [person, partner],
    unions: [
      {
        id: "a|b",
        a: "a",
        b: "b",
        status: "active",
        marriage: "married",
        ended: false,
      },
    ],
  };
  const options = {
    menu: { id: person.id, x: 0, y: 0 },
    menuPerson: person,
    family,
    ancestorFor: null,
    setMenu: vi.fn(),
    onDeath: vi.fn(),
    onPartner: vi.fn(),
    onChild: vi.fn(),
    onBranch: vi.fn(),
    onSeparate: vi.fn(),
    onDynasty: vi.fn(),
    onJoinDynasty: vi.fn(),
    onAncestors: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
  };
  return { options, person, family };
}

describe("person context menu", () => {
  it("disables another active partnership and keeps removal last", () => {
    const { options, family } = fixture();
    const original = structuredClone(family);
    const items = personMenuItems(options);
    expect(items.find((item) => item.key === "partner")?.disabled).toBe(true);
    expect(items.find((item) => item.key === "a|b")?.label).toBe(
      t("recordDivorce"),
    );
    expect(items.at(-1)).toMatchObject({
      key: "remove",
      danger: true,
      split: true,
    });
    expect(family).toEqual(original);
  });

  it("keeps a former couple's child action immediately after the single-child action in every language", () => {
    const { options, family } = fixture();
    family.unions[0].status = "separated";
    family.unions[0].marriage = "divorced";
    for (const locale of ["de", "en", "ko"] as const) {
      setLocale(locale);
      const items = personMenuItems(options);
      const childAt = items.findIndex((item) => item.key === "single-child");
      expect(items[childAt + 1]).toMatchObject({
        key: "child-a|b",
        nested: true,
      });
      expect(items.find((item) => item.key === "partner")?.disabled).toBe(
        false,
      );
      expect(items.some((item) => item.key === "a|b")).toBe(false);
      items[childAt + 1].onClick();
      expect(options.onBranch).toHaveBeenLastCalledWith("a|b");
    }
  });

  it("runs the ancestor action before closing and respects completed parents", () => {
    const { options, person } = fixture();
    const calls: string[] = [];
    options.onAncestors.mockImplementation((id) => calls.push(id));
    options.setMenu.mockImplementation(() => calls.push("closed"));
    personMenuItems(options)
      .find((item) => item.key === "ancestor")!
      .onClick();
    expect(calls).toEqual(["a", "closed"]);
    person.parents = ["parent1", "parent2"];
    expect(
      personMenuItems(options).find((item) => item.key === "ancestor"),
    ).toMatchObject({ disabled: true, label: t("parentsComplete") });
  });

  it("returns no actions when the menu or person is absent", () => {
    const { options } = fixture();
    expect(personMenuItems({ ...options, menu: null })).toEqual([]);
    expect(personMenuItems({ ...options, menuPerson: undefined })).toEqual([]);
  });
});
