import { describe, expect, it } from "vitest";
import {
  newPerson,
  normalize,
  updatePerson,
  validate,
  unionKey,
  type Family,
} from "../src/domain";
import {
  ancestorSlotsFor,
  flowingConnector,
  layoutFamily,
  preserveLayout,
  freePosition,
  positionsOverlap,
  besideConnection,
  smoothLink,
  softRoute,
  freePair,
  tidyLayout,
  anchorSeparation,
  blockersAround,
  personFootprint,
  dynastyRegion,
  personFace,
  partnerSlotBox,
  clearLink,
  type Layout,
} from "../src/layout";

const modes: Layout[] = ["classic", "horizontal", "tapestry"];
function couple(): Family {
  return {
    version: 2,
    name: "Test",
    members: [
      { ...newPerson(), id: "a", name: "Anna" },
      { ...newPerson(), id: "b", name: "Bert" },
    ],
    unions: [{ id: "a|b", a: "a", b: "b", status: "active", ended: false }],
  };
}
function sampleCurve(d: string) {
  const parts = d.match(/[MLC][^MLC]*/g) || [];
  let current = { x: 0, y: 0 };
  const points: { x: number; y: number }[] = [];
  for (const part of parts) {
    const nums = part
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (part[0] === "M" || part[0] === "L") {
      current = { x: nums[0], y: nums[1] };
      points.push(current);
      continue;
    }
    const c1 = { x: nums[0], y: nums[1] },
      c2 = { x: nums[2], y: nums[3] },
      end = { x: nums[4], y: nums[5] };
    for (let t = 0.05; t <= 1; t += 0.05) {
      const mt = 1 - t;
      points.push({
        x:
          mt ** 3 * current.x +
          3 * mt ** 2 * t * c1.x +
          3 * mt * t ** 2 * c2.x +
          t ** 3 * end.x,
        y:
          mt ** 3 * current.y +
          3 * mt ** 2 * t * c1.y +
          3 * mt * t ** 2 * c2.y +
          t ** 3 * end.y,
      });
    }
    current = end;
  }
  return points;
}

function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
function assertNoOverlap(f: Family, mode: Layout) {
  const scene = layoutFamily(f, mode, null);
  const people = Object.values(scene.positions);
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++)
      expect(positionsOverlap(people[i], people[j], mode)).toBe(false);
  for (const slot of scene.slots) {
    const box = partnerSlotBox(slot, mode);
    for (const [id, person] of Object.entries(scene.positions))
      if (id !== slot.id)
        expect(boxesOverlap(box, personFootprint(person, mode))).toBe(false);
    expect(boxesOverlap(box, personFace(scene.positions[slot.id], mode))).toBe(
      false,
    );
    const owner = personFace(scene.positions[slot.id], mode);
    const gap =
      box.x >= owner.x
        ? box.x - (owner.x + owner.w)
        : owner.x - (box.x + box.w);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(20);
  }
}

describe("Stable positions across partnerships", () => {
  for (const mode of modes) {
    it(`${mode}: divorce retains positions, a partner takes the free opposite side`, () => {
      const before = preserveLayout(null, couple());
      const old = layoutFamily(before, mode, null);
      const divorced = structuredClone(before);
      divorced.unions[0].status = "separated";
      expect(layoutFamily(divorced, mode, null).positions).toEqual(
        old.positions,
      );
      const after = preserveLayout(
        before,
        updatePerson(
          divorced,
          { ...newPerson(), id: "c", name: "New partner" },
          "a",
        ),
      );
      const scene = layoutFamily(after, mode, null);
      expect(scene.positions.a).toEqual(old.positions.a);
      expect(scene.positions.b).toEqual(old.positions.b);
      const axis = mode === "horizontal" ? "y" : "x";
      expect(
        (scene.positions.c[axis] - scene.positions.a[axis]) *
          (scene.positions.b[axis] - scene.positions.a[axis]),
      ).toBeLessThan(0);
      assertNoOverlap(after, mode);
    });
    it(`${mode}: three partnerships retain their own children and positions`, () => {
      let f = preserveLayout(null, couple());
      for (const [partner, child] of [
        ["b", "child1"],
        ["c", "child2"],
        ["d", "child3"],
      ]) {
        if (partner !== "b") {
          const separated = structuredClone(f);
          separated.unions.forEach((u) => {
            u.status = "separated";
          });
          const before = layoutFamily(f, mode, null).positions;
          f = preserveLayout(
            f,
            updatePerson(
              separated,
              { ...newPerson(), id: partner, name: partner },
              "a",
            ),
          );
          for (const [id, point] of Object.entries(before))
            expect(layoutFamily(f, mode, null).positions[id]).toEqual(point);
        }
        f = preserveLayout(
          f,
          updatePerson(
            f,
            { ...newPerson(), id: child, name: child, parents: ["a", partner] },
            "",
          ),
        );
      }
      const scene = layoutFamily(f, mode, null);
      expect(scene.unions.filter((u) => u.separated)).toHaveLength(2);
      for (const [partner, child] of [
        ["b", "child1"],
        ["c", "child2"],
        ["d", "child3"],
      ]) {
        const union = scene.unions.find(
          (u) => u.id === unionKey("a", partner),
        )!;
        expect(union.children).toHaveLength(1);
        expect(f.members.find((p) => p.id === child)?.parents).toEqual([
          "a",
          partner,
        ]);
      }
      assertNoOverlap(f, mode);
      const moved = structuredClone(f);
      moved.members[0].positions![mode] = { x: -700, y: -190 };
      const after = layoutFamily(moved, mode, null);
      for (const id of Object.keys(scene.positions).filter((id) => id !== "a"))
        expect(after.positions[id]).toEqual(scene.positions[id]);
      expect(after.unions.map((u) => u.partnerPath)).not.toEqual(
        scene.unions.map((u) => u.partnerPath),
      );
      expect(
        normalize(JSON.parse(JSON.stringify(moved))).members[0].positions,
      ).toEqual(moved.members[0].positions);
    });
  }
  it("finds a nearby free drop position without moving existing people", () => {
    const occupied = [
      { x: 0, y: 0 },
      { x: 250, y: 0 },
      { x: -250, y: 0 },
    ];
    const snapshot = structuredClone(occupied);
    const free = freePosition({ x: 10, y: 10 }, occupied, "tapestry");
    expect(occupied.every((p) => !positionsOverlap(p, free, "tapestry"))).toBe(
      true,
    );
    expect(occupied).toEqual(snapshot);
    expect(Math.hypot(free.x - 10, free.y - 10)).toBeLessThan(180);
  });
  it("keeps a drop beside the nearest person instead of flinging it away", () => {
    const person = anchorSeparation("tapestry", "person");
    const free = freePosition({ x: 180, y: 0 }, [{ x: 0, y: 0 }], "tapestry");
    expect(positionsOverlap(free, { x: 0, y: 0 }, "tapestry")).toBe(false);
    expect(free.y).toBeCloseTo(0, 0);
    expect(free.x).toBeCloseTo(person.x, 0);
    const landed = freePosition({ x: 0, y: 0 }, [{ x: 0, y: 0 }], "tapestry");
    expect(landed.y).toBeCloseTo(0, 0);
    expect(Math.abs(landed.x)).toBeCloseTo(person.x, 0);
    const pair = freePair(
      { x: 180, y: 0 },
      { x: 180 + person.x, y: 0 },
      [{ x: 0, y: 0 }],
      "tapestry",
    );
    expect(positionsOverlap(pair.a, { x: 0, y: 0 }, "tapestry")).toBe(false);
    expect(pair.a.y).toBeCloseTo(0, 0);
    expect(pair.a.x).toBeCloseTo(person.x, 0);
    expect(pair.b.x - pair.a.x).toBeCloseTo(person.x, 0);
  });
  it("sets a couple that was pushed too close beside the other couple", () => {
    const family: Family = {
      version: 2,
      name: "T",
      members: ["mk", "kk", "bm", "pm"].map((id) => ({
        ...newPerson(),
        id,
        name: id,
      })),
      unions: [
        { id: "mk|kk", a: "mk", b: "kk", status: "active", ended: false },
        { id: "bm|pm", a: "bm", b: "pm", status: "active", ended: false },
      ],
    };
    const person = anchorSeparation("tapestry", "person").x;
    const pair = anchorSeparation("tapestry", "pair").x;
    const positions = {
      mk: { x: 0, y: 0 },
      kk: { x: person, y: 0 },
      bm: { x: person + pair * 0.35, y: 0 },
      pm: { x: person + pair * 0.35 + person, y: 0 },
    };
    const placed = freePair(
      positions.bm,
      positions.pm,
      blockersAround(family, positions, "bm", "tapestry", ["pm"]),
      "tapestry",
      blockersAround(family, positions, "pm", "tapestry", ["bm"]),
    );
    expect(placed.a.y).toBeCloseTo(0, 0);
    expect(placed.b.y).toBeCloseTo(0, 0);
    expect(placed.b.x - placed.a.x).toBeCloseTo(person, 0);
    expect(placed.a.x - positions.kk.x).toBeGreaterThanOrEqual(pair - 1);
    expect(placed.a.x).toBeCloseTo(positions.kk.x + pair, 0);
    expect(Math.hypot(placed.a.x - positions.bm.x, placed.a.y)).toBeLessThan(
      pair,
    );
  });
  it("keeps two couples a pair-width apart after packing", () => {
    const family: Family = {
      version: 2,
      name: "T",
      members: [
        { ...newPerson(), id: "mk", name: "Marion" },
        { ...newPerson(), id: "kk", name: "Klaus" },
        { ...newPerson(), id: "bm", name: "Birgit" },
        { ...newPerson(), id: "pm", name: "Peter" },
      ],
      unions: [
        { id: "mk|kk", a: "mk", b: "kk", status: "active", ended: false },
        { id: "bm|pm", a: "bm", b: "pm", status: "active", ended: false },
      ],
    };
    for (const mode of modes) {
      const scene = layoutFamily(tidyLayout(family, mode, true), mode, null);
      const people = Object.values(scene.positions);
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++)
          expect(positionsOverlap(people[i], people[j], mode)).toBe(false);
      const along = (id: string) =>
        mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
      const cross = (id: string) =>
        mode === "horizontal" ? scene.positions[id].x : scene.positions[id].y;
      const person = anchorSeparation(mode, "person");
      const pair = anchorSeparation(mode, "pair");
      const personAlong = mode === "horizontal" ? person.y : person.x;
      const pairAlong = mode === "horizontal" ? pair.y : pair.x;
      expect(Math.abs(cross("mk") - cross("kk"))).toBeLessThan(8);
      expect(Math.abs(along("mk") - along("kk"))).toBeCloseTo(personAlong, 0);
      expect(Math.abs(along("bm") - along("pm"))).toBeCloseTo(personAlong, 0);
      const gap = Math.min(
        Math.abs(along("mk") - along("bm")),
        Math.abs(along("mk") - along("pm")),
        Math.abs(along("kk") - along("bm")),
        Math.abs(along("kk") - along("pm")),
      );
      expect(gap).toBeGreaterThanOrEqual(pairAlong - 1);
      expect(positionsOverlap(scene.positions.kk, scene.positions.bm, mode, "pair")).toBe(
        false,
      );
    }
    const siblings: Family = {
      version: 2,
      name: "T",
      members: [
        { ...newPerson(), id: "g", name: "Opa" },
        { ...newPerson(), id: "h", name: "Oma" },
        { ...newPerson(), id: "mk", name: "Marion", parents: ["g", "h"] },
        { ...newPerson(), id: "kk", name: "Klaus" },
        { ...newPerson(), id: "bm", name: "Birgit", parents: ["g", "h"] },
        { ...newPerson(), id: "pm", name: "Peter" },
      ],
      unions: [
        { id: "g|h", a: "g", b: "h", status: "active", ended: false },
        { id: "mk|kk", a: "mk", b: "kk", status: "active", ended: false },
        { id: "bm|pm", a: "bm", b: "pm", status: "active", ended: false },
      ],
    };
    const packed = layoutFamily(tidyLayout(siblings, "tapestry", true), "tapestry", null);
    const x = (id: string) => packed.positions[id].x;
    const person = anchorSeparation("tapestry", "person").x;
    const pair = anchorSeparation("tapestry", "pair").x;
    expect(Math.abs(x("mk") - x("kk"))).toBeCloseTo(person, 0);
    expect(Math.abs(x("bm") - x("pm"))).toBeCloseTo(person, 0);
    const inner = Math.min(
      Math.abs(x("mk") - x("bm")),
      Math.abs(x("mk") - x("pm")),
      Math.abs(x("kk") - x("bm")),
      Math.abs(x("kk") - x("pm")),
    );
    expect(inner).toBeGreaterThanOrEqual(pair - 1);
    expect(packed.positions.mk.y).toBeCloseTo(packed.positions.kk.y, 0);
    expect(packed.positions.bm.y).toBeCloseTo(packed.positions.pm.y, 0);
  });
  it("draws connectors as smooth curves instead of right angles", () => {
    const sideBySide = flowingConnector({ x: 0, y: 40 }, { x: 220, y: 48 });
    expect(sideBySide).toBe("M0,40C99,40 121,48 220,48");
    const route = softRoute([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 240 },
      { x: 360, y: 240 },
    ]);
    expect(route).toContain("C");
    expect(route).not.toMatch(/[HV]/);
    const scene = layoutFamily(couple(), "tapestry", null);
    const saved = preserveLayout(null, couple());
    saved.members[1].positions = {
      tapestry: { x: scene.positions.b.x + 520, y: scene.positions.b.y + 40 },
    };
    const far = layoutFamily(saved, "tapestry", null);
    expect(far.unions[0].partnerPath).toContain("C");
    expect(far.unions[0].partnerPath).not.toMatch(/[HV]/);
    const moved = smoothLink({ x: 0, y: 0 }, { x: 420, y: 40 }, "tapestry");
    const ys = moved.d
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number)
      .filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(80);
    const marker = besideConnection(moved.a, moved.b, moved.mid, "tapestry");
    expect(Math.hypot(marker.x - moved.mid.x, marker.y - moved.mid.y)).toBeGreaterThan(
      30,
    );
  });
  it("opens an ancestor place only for the person who asked, not their partner", () => {
    const family = couple();
    const scene = layoutFamily(family, "tapestry", null);
    const slots = ancestorSlotsFor(
      family,
      scene.positions,
      "a",
      "tapestry",
      scene.slots,
    );
    expect(slots.map((item) => item.personId)).toEqual(["a"]);
    expect(positionsOverlap(slots[0], scene.positions.a, "tapestry")).toBe(
      false,
    );
    expect(positionsOverlap(slots[0], scene.positions.b, "tapestry")).toBe(
      false,
    );
  });
  it("opens a free ancestor place beside a partner who already has a parent", () => {
    const family = couple();
    family.members.push({ ...newPerson(), id: "p", name: "Parent" });
    family.members.find((person) => person.id === "b")!.parents = ["p"];
    const scene = layoutFamily(family, "tapestry", null);
    const slots = ancestorSlotsFor(
      family,
      scene.positions,
      "a",
      "tapestry",
      scene.slots,
    );
    const slot = slots.find((item) => item.personId === "a");
    expect(slot).toBeTruthy();
    expect(slots.some((item) => item.personId === "b")).toBe(false);
    for (const point of Object.values(scene.positions))
      expect(positionsOverlap(slot!, point, "tapestry")).toBe(false);
    expect(Math.abs(slot!.y - scene.positions.p.y)).toBeLessThan(20);
  });
  it("keeps a second-parent slot free when the known parent already has a partner", () => {
    const family = couple();
    family.members.push({
      ...newPerson(),
      id: "c",
      name: "Child",
      parents: ["a"],
    });
    const scene = layoutFamily(family, "classic", null);
    const second = ancestorSlotsFor(family, scene.positions, "c", "classic");
    expect(second.some((item) => item.personId === "c")).toBe(true);
    for (const point of Object.values(scene.positions))
      expect(
        positionsOverlap(
          second.find((item) => item.personId === "c")!,
          point,
          "classic",
        ),
      ).toBe(false);
  });
  it("moves a married or divorced pair together without covering anyone else", () => {
    const family = couple();
    family.members.push({ ...newPerson(), id: "c", name: "Cora" });
    family.unions[0].marriage = "divorced";
    family.unions[0].status = "separated";
    const scene = layoutFamily(family, "tapestry", null);
    const placed = freePair(
      { x: scene.positions.c.x, y: scene.positions.c.y },
      {
        x: scene.positions.c.x + (scene.positions.b.x - scene.positions.a.x),
        y: scene.positions.c.y + (scene.positions.b.y - scene.positions.a.y),
      },
      [scene.positions.c],
      "tapestry",
    );
    expect(placed.b.x - placed.a.x).toBeCloseTo(
      scene.positions.b.x - scene.positions.a.x,
    );
    expect(positionsOverlap(placed.a, scene.positions.c, "tapestry")).toBe(
      false,
    );
    expect(positionsOverlap(placed.b, scene.positions.c, "tapestry")).toBe(
      false,
    );
  });
  it("rebuilds a family under its parents without crossed lines or overlaps", () => {
    const family: Family = {
      version: 2,
      name: "T",
      members: [
        { ...newPerson(), id: "g", name: "Opa" },
        { ...newPerson(), id: "h", name: "Oma" },
        { ...newPerson(), id: "a", name: "Anna", parents: ["g"] },
        { ...newPerson(), id: "b", name: "Bert", parents: ["h"] },
        { ...newPerson(), id: "c1", name: "Clara", parents: ["a", "b"] },
        { ...newPerson(), id: "c2", name: "Dora", parents: ["a", "b"] },
        { ...newPerson(), id: "c3", name: "Emil", parents: ["a", "b"] },
      ],
      unions: [
        {
          id: "a|b",
          a: "a",
          b: "b",
          status: "active",
          ended: false,
          marriage: "married",
        },
      ],
    };
    for (const mode of modes) {
      const tidy = tidyLayout(family, mode, true);
      const scene = layoutFamily(tidy, mode, null);
      const center = (id: string) =>
        mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
      const people = Object.values(scene.positions);
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++)
          expect(boxesOverlap(personFootprint(people[i], mode), personFootprint(people[j], mode))).toBe(
            false,
          );
      expect((center("h") - center("g")) * (center("b") - center("a"))).toBeGreaterThan(0);
      const childCenters = ["c1", "c2", "c3"].map(center).sort((a, b) => a - b);
      const couple = (center("a") + center("b")) / 2;
      const childMid = (childCenters[0] + childCenters[2]) / 2;
      expect(Math.abs(childMid - couple)).toBeLessThan(40);
      expect(childCenters[2] - childCenters[0]).toBeLessThan(
        mode === "tapestry" ? 900 : 800,
      );
      expect(scene.positions.c1.y).not.toBe(scene.positions.a.y);
    }
  });
  it("keeps a partnership attached when a child sits on the same row", () => {
    const family = couple();
    family.members.push({
      ...newPerson(),
      id: "c",
      name: "Child",
      parents: ["a", "b"],
    });
    const packed = structuredClone(family);
    packed.members.find((person) => person.id === "c")!.positions = {
      classic: { x: 0, y: 0 },
    };
    const scene = layoutFamily(packed, "classic", null);
    const link = scene.unions[0];
    expect(link.a.y).toBeCloseTo(scene.positions.a.y + 60, 0);
    expect(link.b.y).toBeCloseTo(scene.positions.b.y + 60, 0);
    expect(link.partnerPath).toContain("C");
    expect(link.childPaths?.[0]).toBeTruthy();
    expect(link.childPaths?.[0]).toContain("C");
    expect(link.childPaths?.[0]).not.toMatch(/[HV]/);
  });
  it("draws child lines as smooth curves that stay off name plates", () => {
    const family = couple();
    family.members.push(
      { ...newPerson(), id: "c1", name: "Clara", parents: ["a", "b"] },
      { ...newPerson(), id: "c2", name: "Dora", parents: ["a", "b"] },
    );
    for (const mode of modes) {
      const scene = layoutFamily(tidyLayout(family, mode, true), mode, null);
      const link = scene.unions[0];
      const cards = Object.values(scene.positions).map((point) =>
        personFootprint(point, mode),
      );
      expect(link.partnerPath).toContain("C");
      expect(link.childPaths?.length).toBe(2);
      for (const path of link.childPaths || []) {
        expect(path).toContain("C");
        expect(path).not.toMatch(/[HV]/);
        for (const point of sampleCurve(path)) {
          for (const box of cards) {
            expect(
              point.x > box.x + 3 &&
                point.x < box.x + box.w - 3 &&
                point.y > box.y + 3 &&
                point.y < box.y + box.h - 3,
            ).toBe(false);
          }
        }
      }
    }
  });
  it("keeps a new partner and their placeholder off a divorce line", () => {
    const family: Family = {
      version: 2,
      name: "T",
      members: [
        { ...newPerson(), id: "a", name: "Anna" },
        { ...newPerson(), id: "b", name: "Bert" },
        { ...newPerson(), id: "c", name: "Cora" },
      ],
      unions: [
        {
          id: "a|b",
          a: "a",
          b: "b",
          status: "separated",
          ended: false,
          marriage: "divorced",
        },
        {
          id: "a|c",
          a: "a",
          b: "c",
          status: "active",
          ended: false,
          marriage: "married",
        },
      ],
    };
    for (const mode of modes) {
      const tidy = tidyLayout(family, mode, true);
      const scene = layoutFamily(tidy, mode, null);
      const along = (id: string) =>
        mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
      const sameRow =
        mode === "horizontal"
          ? scene.positions.c.x === scene.positions.a.x
          : scene.positions.c.y === scene.positions.a.y;
      if (sameRow)
        expect((along("c") - along("a")) * (along("b") - along("a"))).toBeLessThan(0);
      else
        expect(
          mode === "horizontal"
            ? scene.positions.c.x > scene.positions.a.x
            : scene.positions.c.y > scene.positions.a.y,
        ).toBe(true);
      const obstacles = [
        personFootprint(scene.positions.c, mode),
        ...scene.slots.map((slot) => partnerSlotBox(slot, mode)),
      ];
      const divorce = scene.unions.find((union) => union.id === "a|b")!;
      const numbers = divorce.partnerPath!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        const point = { x: numbers[index], y: numbers[index + 1] };
        for (const box of obstacles)
          expect(
            point.x > box.x &&
              point.x < box.x + box.w &&
              point.y > box.y &&
              point.y < box.y + box.h,
          ).toBe(false);
      }
      const slot = scene.slots.find((item) => item.id === "b");
      if (slot) {
        const box = partnerSlotBox(slot, mode);
        const owner = personFace(scene.positions.b, mode);
        expect(
          box.x + box.w < owner.x ||
            box.x > owner.x + owner.w ||
            Math.abs(box.x - owner.x) > 1,
        ).toBe(true);
      }
      const routed = clearLink(scene.positions.a, scene.positions.b, mode, [
        personFootprint(scene.positions.c, mode),
      ]);
      expect(routed.d).toBeTruthy();
    }
  });
  it("pulls scattered cards into the starting layout without overlaps", () => {
    const family = couple();
    family.members[0].positions = {
      classic: { x: -4000, y: 3000 },
      tapestry: { x: 12, y: 34 },
    };
    family.members[1].positions = { classic: { x: 5000, y: -2000 } };
    const tidy = tidyLayout(family, "classic");
    expect(tidy.members[0].positions?.tapestry).toEqual({ x: 12, y: 34 });
    const points = Object.values(layoutFamily(tidy, "classic", null).positions);
    expect(positionsOverlap(points[0], points[1], "classic")).toBe(false);
    expect(Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)).toBeLessThan(
      800,
    );
  });
  it("keeps a partner place beside two children and opens a gap when they are packed", () => {
    let family = preserveLayout(null, {
      version: 2,
      name: "T",
      members: [{ ...newPerson(), id: "p", name: "Parent" }],
      unions: [],
    });
    family = preserveLayout(
      family,
      updatePerson(family, { ...newPerson(), id: "c1", name: "SX", parents: ["p"] }, ""),
    );
    family = preserveLayout(
      family,
      updatePerson(family, { ...newPerson(), id: "c2", name: "DM", parents: ["p"] }, ""),
    );
    for (const mode of modes) {
      const scene = layoutFamily(family, mode, null);
      for (const id of ["c1", "c2"]) {
        const slot = scene.slots.find((item) => item.id === id)!;
        const owner = personFace(scene.positions[id], mode);
        const box = partnerSlotBox(slot, mode);
        const gap =
          box.x >= owner.x
            ? box.x - (owner.x + owner.w)
            : owner.x - (box.x + box.w);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(20);
        expect(Math.abs(box.y - owner.y)).toBeLessThan(40);
      }
    }
    const packed = {
      version: 2 as const,
      name: "T",
      members: ["a", "b", "c"].map((id, index) => ({
        ...newPerson(),
        id,
        name: id,
        positions: { tapestry: { x: index * 40, y: 0 } },
      })),
      unions: [],
    };
    const opened = layoutFamily(packed, "tapestry", null);
    expect(
      opened.positions.a.x !== 0 ||
        opened.positions.b.x !== 40 ||
        opened.positions.c.x !== 80,
    ).toBe(true);
    for (const slot of opened.slots) {
      const box = partnerSlotBox(slot, "tapestry");
      const owner = personFace(opened.positions[slot.id], "tapestry");
      const gap =
        box.x >= owner.x
          ? box.x - (owner.x + owner.w)
          : owner.x - (box.x + box.w);
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(20);
      for (const [id, person] of Object.entries(opened.positions))
        if (id !== slot.id)
          expect(boxesOverlap(box, personFootprint(person, "tapestry"))).toBe(
            false,
          );
    }
    const hidden = layoutFamily(packed, "tapestry", null, {}, { partnerSlots: false });
    expect(hidden.slots).toEqual([]);
    expect(hidden.positions.b).toEqual({ x: 40, y: 0 });
  });
  it("seats a couple between both parents' branches, each partner on their own side", () => {
    const person = (id: string, name: string, parents: string[] = []) => ({
      ...newPerson(),
      id,
      name,
      parents,
    });
    const link = (a: string, b: string) => ({
      id: `${a}|${b}`,
      a,
      b,
      status: "active" as const,
      ended: false,
    });
    const family: Family = {
      version: 2,
      name: "T",
      members: [
        person("ada", "Ada"),
        person("ben", "Ben"),
        person("mia", "Mia", ["ada", "ben"]),
        person("jun", "Jun", ["ada", "ben"]),
        person("her", "Hera"),
        person("zach", "Zach"),
        person("gina", "Gina", ["zach"]),
        person("horst", "Horst"),
        person("andreas", "Andreas", ["gina", "horst"]),
        person("marion", "Marion"),
        person("arne", "Arne", ["andreas", "marion"]),
        person("eric", "Eric", ["andreas", "marion"]),
        person("birgit", "Birgit", ["gina", "horst"]),
        person("peter", "Peter"),
        person("cousin", "Cousin", ["birgit", "peter"]),
      ],
      unions: [
        link("ada", "ben"),
        link("jun", "her"),
        link("gina", "horst"),
        link("andreas", "marion"),
        link("mia", "arne"),
        link("birgit", "peter"),
      ],
    };
    for (const mode of modes) {
      const scene = layoutFamily(tidyLayout(family, mode, true), mode, null);
      const along = (id: string) =>
        mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
      const people = Object.values(scene.positions);
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++)
          expect(
            boxesOverlap(personFootprint(people[i], mode), personFootprint(people[j], mode)),
          ).toBe(false);
      const side = (ids: string[]) =>
        ids.reduce((sum, id) => sum + along(id), 0) / ids.length;
      const miaSide = side(["ada", "ben"]);
      const arneSide = side(["andreas", "marion"]);
      expect(miaSide).toBeLessThan(arneSide);
      expect(along("mia")).toBeLessThan(along("arne"));
      expect(Math.abs(along("mia") - miaSide)).toBeLessThan(Math.abs(along("arne") - miaSide));
      expect(Math.abs(along("arne") - arneSide)).toBeLessThan(
        Math.abs(along("mia") - arneSide),
      );
      const couple = (along("mia") + along("arne")) / 2;
      expect(couple).toBeLessThan(along("cousin"));
      expect(couple).toBeGreaterThan(Math.min(along("ada"), along("ben")) - 40);
      expect(Math.abs(couple - (miaSide + arneSide) / 2)).toBeLessThan(
        mode === "tapestry" ? 200 : 120,
      );
    }
  });
  it("drops a partner's shallow family onto the couple's generations", () => {
    const person = (id: string, name: string, parents: string[] = []) => ({
      ...newPerson(),
      id,
      name,
      parents,
    });
    const link = (a: string, b: string) => ({
      id: `${a}|${b}`,
      a,
      b,
      status: "active" as const,
      ended: false,
    });
    const deepPartner: Family = {
      version: 2,
      name: "T",
      members: [
        person("gg", "Uropa"),
        person("gp", "Opa", ["gg"]),
        person("pa", "Vater", ["gp"]),
        person("arne", "Arne", ["pa"]),
        person("eric", "Eric", ["pa"]),
        person("kl", "Kyungmyung"),
        person("my", "Moonja"),
        person("yl", "Yuseon", ["kl", "my"]),
        person("jl", "Joonghee", ["kl", "my"]),
        person("hk", "Haeun", ["kl", "my"]),
        person("sp", "Minho", ["spp"]),
        person("spp", "MinhoVater"),
      ],
      unions: [link("kl", "my"), link("yl", "arne"), link("hk", "sp")],
    };
    const deepInLaws: Family = {
      version: 2,
      name: "T",
      members: [
        person("ma", "Mutter"),
        person("arne", "Arne", ["ma"]),
        person("gg", "Uropa"),
        person("gp", "Opa", ["gg"]),
        person("pa", "Vater", ["gp"]),
        person("yl", "Yuseon", ["pa"]),
        person("jl", "Joonghee", ["pa"]),
      ],
      unions: [link("yl", "arne")],
    };
    for (const mode of modes) {
      for (const family of [deepPartner, deepInLaws]) {
        const scene = layoutFamily(tidyLayout(family, mode, true), mode, null);
        const cross = (id: string) =>
          mode === "horizontal" ? scene.positions[id].x : scene.positions[id].y;
        const same = (a: string, b: string) =>
          expect(cross(a)).toBeCloseTo(cross(b), 0);
        same("yl", "arne");
        same("jl", "yl");
        if (family === deepPartner) {
          same("hk", "yl");
          same("sp", "hk");
          same("kl", "my");
          same("kl", "pa");
          same("spp", "pa");
          expect(cross("gg")).toBeLessThan(cross("gp"));
          expect(cross("gp")).toBeLessThan(cross("pa"));
          expect(cross("kl")).toBeGreaterThan(cross("gg"));
        } else {
          same("ma", "pa");
          expect(cross("ma")).toBeGreaterThan(cross("gg"));
          expect(cross("gg")).toBeLessThan(cross("gp"));
          expect(cross("gp")).toBeLessThan(cross("pa"));
        }
        expect(cross("pa")).toBeLessThan(cross("arne"));
        if (family === deepPartner) {
          const along = (id: string) =>
            mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
          const span = (kind: "person" | "pair") =>
            mode === "horizontal"
              ? anchorSeparation(mode, kind).y
              : anchorSeparation(mode, kind).x;
          const nearestSibling = Math.min(
            Math.abs(along("yl") - along("jl")),
            Math.abs(along("yl") - along("hk")),
            Math.abs(along("yl") - along("sp")),
          );
          expect(nearestSibling).toBeGreaterThan(span("person") * 0.75);
          expect(nearestSibling).toBeLessThan(span("pair") + 8);
          const brother = Math.abs(along("arne") - along("eric"));
          expect(brother).toBeGreaterThan(span("person") * 0.75);
          expect(brother).toBeLessThan(span("pair"));
        }
      }
    }
  });
  it("parks an in-law line beside its partner and leaves cousins under their parents", () => {
    const person = (id: string, name: string, parents: string[] = []) => ({
      ...newPerson(),
      id,
      name,
      parents,
    });
    const link = (a: string, b: string) => ({
      id: `${a}|${b}`,
      a,
      b,
      status: "active" as const,
      ended: false,
    });
    const family: Family = {
      version: 2,
      name: "T",
      members: [
        person("wm", "Wilhelm"),
        person("em", "Elisabeth"),
        person("tm", "Thomas", ["wm", "em"]),
        person("cm", "Clara"),
        person("jw", "Johanna", ["wm", "em"]),
        person("mw", "Michael"),
        person("lm", "Lena", ["tm", "cm"]),
        person("fm", "Felix", ["tm", "cm"]),
        person("ew", "Emma", ["jw", "mw"]),
        person("kb", "Katharina"),
        person("hb", "Hans", ["kb"]),
        person("jb", "Jonas", ["hb"]),
        person("mb", "Mia", ["lm", "jb"]),
      ],
      unions: [
        link("wm", "em"),
        link("tm", "cm"),
        link("jw", "mw"),
        link("lm", "jb"),
      ],
    };
    for (const mode of modes) {
      const scene = layoutFamily(tidyLayout(family, mode, true), mode, null);
      const along = (id: string) =>
        mode === "horizontal" ? scene.positions[id].y : scene.positions[id].x;
      const cross = (id: string) =>
        mode === "horizontal" ? scene.positions[id].x : scene.positions[id].y;
      const people = Object.values(scene.positions);
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++)
          expect(
            boxesOverlap(
              personFootprint(people[i], mode),
              personFootprint(people[j], mode),
            ),
          ).toBe(false);
      const span = (kind: "person" | "pair") =>
        mode === "horizontal"
          ? anchorSeparation(mode, kind).y
          : anchorSeparation(mode, kind).x;
      expect(cross("kb")).toBeLessThan(cross("hb"));
      expect(cross("hb")).toBeLessThan(cross("jb"));
      expect(cross("jb")).toBeCloseTo(cross("lm"), 0);
      expect(cross("ew")).toBeCloseTo(cross("fm"), 0);
      expect(cross("mb")).toBeGreaterThan(cross("lm"));
      expect(along("jb")).toBeLessThan(along("lm"));
      expect(Math.abs(along("jb") - along("hb"))).toBeLessThan(span("person"));
      expect(Math.abs(along("ew") - along("mw"))).toBeLessThan(span("person"));
      expect(along("lm")).toBeLessThan(along("fm"));
      const sibling = Math.abs(along("fm") - along("lm"));
      expect(sibling).toBeGreaterThan(span("person") * 0.75);
      expect(sibling).toBeLessThan(span("person") * 1.5);
      const betweenSiblingAndCousin =
        along("ew") > Math.min(along("fm"), along("lm")) &&
        along("ew") < Math.max(along("fm"), along("lm"));
      expect(betweenSiblingAndCousin).toBe(false);
      expect(Math.abs(along("lm") - along("jb"))).toBeLessThan(span("pair") + 8);
    }
  });
  it("rejects invalid saved coordinates while accepting legacy files", () => {
    const f = couple();
    expect(() => validate(f)).not.toThrow();
    f.members[0].positions = { classic: { x: NaN, y: 1 } };
    expect(() => validate(f)).toThrow("Stammbaumposition");
    f.members[0].positions = { classic: { x: 1_000_001, y: 1 } };
    expect(() => validate(f)).toThrow("Stammbaumposition");
  });
  it("schiebt Fremde neben den Dynastiebereich", () => {
    const family = normalize({
      version: 2,
      name: "Wand",
      members: [
        { ...newPerson(), id: "a", name: "Ada", parents: [] },
        { ...newPerson(), id: "b", name: "Bea", parents: [] },
        { ...newPerson(), id: "c", name: "Cara", parents: ["a"] },
      ],
      unions: [],
    });
    const ada = family.members.find((p) => p.id === "a")!;
    ada.dynasty = { name: "Ada", logo: "", corner: "left" };
    ada.positions = { tapestry: { x: 0, y: 200 } };
    family.members.find((p) => p.id === "c")!.positions = {
      tapestry: { x: 0, y: 500 },
    };
    family.members.find((p) => p.id === "b")!.positions = {
      tapestry: { x: 30, y: 200 },
    };
    const scene = layoutFamily(family, "tapestry", null);
    const region = dynastyRegion(family, ada, scene.positions, "tapestry");
    expect(region).toBeTruthy();
    const hits = (id: string) => {
      const box = personFootprint(scene.positions[id], "tapestry");
      const rect = region!.rect;
      return (
        box.x < rect.x + rect.w &&
        rect.x < box.x + box.w &&
        box.y < rect.y + rect.h &&
        rect.y < box.y + box.h
      );
    };
    expect(hits("a")).toBe(true);
    expect(hits("c")).toBe(true);
    expect(hits("b")).toBe(false);
    expect(scene.positions.a.x).toBe(0);
    expect(scene.positions.b.x).toBeGreaterThan(30);
  });
});
