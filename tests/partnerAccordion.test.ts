import { describe, expect, it } from "vitest";
import { accordionFamily, partnerGroups, expandedPartnerPositions } from "../src/partnerAccordion";
import { newPerson, type Family } from "../src/domain";
import { layoutFamily, layoutModes, tidyLayout, positionsOverlap, gapKind, cardSeparation } from "../src/layout";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Tree from "../src/Tree";

function fixture(): Family {
  return {
    version: 2, name: "Test",
    members: ["hub", "ex", "former", "current", "child", "unrelated"].map((id, i) => ({
      ...newPerson(), id, name: id, parents: id === "child" ? ["hub", "ex"] : [],
      positions: Object.fromEntries(layoutModes.map(mode => [mode, { x: i * 400, y: id === "child" ? 400 : 0 }])),
    })),
    unions: [
      { id: "ex", a: "hub", b: "ex", marriage: "divorced", status: "separated", marriedOn: "1990-01-01", ended: false },
      { id: "former", a: "hub", b: "former", marriage: "unspecified", status: "separated", ended: false },
      { id: "current", a: "hub", b: "current", marriage: "unspecified", status: "active", ended: false },
    ],
  };
}

describe("partner accordion", () => {
  it.each(layoutModes)("reserves a generation band below three partners in %s", mode => {
    const f = fixture();
    for (const id of ["third", "childMate", "grandchild", "upper"]) f.members.push({ ...newPerson(), id, name: id });
    f.unions.push({ id: "third", a: "hub", b: "third", status: "separated", marriage: "unspecified", ended: false });
    f.unions.push({ id: "childPair", a: "child", b: "childMate", status: "active", marriage: "married", ended: false });
    const gap = cardSeparation(mode);
    const along = mode === "horizontal" ? "y" : "x";
    const cross = mode === "horizontal" ? "x" : "y";
    const point = (x: number, y: number) => ({ [along]: x, [cross]: y }) as {x:number;y:number};
    const saved = Object.fromEntries(f.members.map((p,i)=>[p.id, point(i*500,0)]));
    saved.hub = point(0,0); saved.ex = point(-gap[along]-1,0);
    saved.child = point(0,gap[cross]+30);
    saved.childMate = point(gap[along]+1,gap[cross]+30);
    saved.unrelated = point(2000,gap[cross]+30);
    saved.grandchild = point(0,2*(gap[cross]+30));
    saved.upper = point(0,-300);
    const before = structuredClone(saved);
    const groups = partnerGroups(f);
    const opened = expandedPartnerPositions(f,groups,new Set(["hub"]),saved,mode);
    const bottom = Math.max(...groups[0].foldable.map(id=>opened[id][cross]));
    expect(opened.child[cross]-bottom).toBeGreaterThanOrEqual(gap[cross]);
    const shift = opened.child[cross]-saved.child[cross];
    expect(shift).toBeGreaterThan(0);
    for (const id of ["childMate","unrelated","grandchild"]) expect(opened[id][cross]-saved[id][cross]).toBeCloseTo(shift);
    for (const id of ["hub","ex","upper"]) expect(opened[id]).toEqual(saved[id]);
    expect(expandedPartnerPositions(f,groups,new Set(),saved,mode)).toEqual(saved);
    expect(expandedPartnerPositions(f,groups,new Set(["hub"]),opened,mode)).toEqual(opened);
    expect(saved).toEqual(before);
  });

  it.each(layoutModes)("keeps three additional partners beside the hub on its outside in %s", mode => {
    for (const side of [-1, 1]) {
      const f = fixture();
      f.members.push({ ...newPerson(), id: "third", name: "Third" });
      f.unions.push({ id: "third", a: "hub", b: "third", marriage: "unspecified", status: "separated", ended: false });
      const gap = cardSeparation(mode);
      const along = mode === "horizontal" ? "y" : "x";
      const cross = mode === "horizontal" ? "x" : "y";
      const point = (x: number, y: number) => ({ [along]: x, [cross]: y }) as {x:number;y:number};
      const saved = Object.fromEntries(f.members.map((p,i) => [p.id, point(2000+i*600,2000)]));
      saved.hub = point(0,0);
      saved.ex = point(-side*(gap[along]+1),0);
      saved.child = point(side*(gap[along]+1),gap[cross]+1);
      saved.unrelated = point(side*(gap[along]+1),0);
      const original = structuredClone(saved);
      const groups = partnerGroups(f);
      const expanded = expandedPartnerPositions(f,groups,new Set(['hub']),saved,mode);
      for (const id of groups[0].foldable) {
        expect(expanded[id][along]).toBeCloseTo(side*(gap[along]+0.01));
        for (const other of Object.keys(expanded)) if (id!==other)
          expect(positionsOverlap(expanded[id],expanded[other],mode,gapKind(f,id,other))).toBe(false);
      }
      expect(expanded.hub).toEqual(saved.hub);
      expect(expanded.ex).toEqual(saved.ex);
      expect(expandedPartnerPositions(f,groups,new Set(['hub']),expanded,mode)).toEqual(expanded);
      expect(saved).toEqual(original);
    }
  });

  it.each(layoutModes)("expands only childless partners with minimum distances in %s", mode => {
    const f = tidyLayout(fixture(), mode);
    const groups = partnerGroups(f);
    const saved = layoutFamily(f, mode, null).positions;
    const before = structuredClone(saved);
    const expanded = expandedPartnerPositions(f, groups, new Set(["hub"]), saved, mode);
    for (const id of ["hub", "ex"]) expect(expanded[id]).toEqual(saved[id]);
    expect(expanded.unrelated[mode === "horizontal" ? "x" : "y"]).toBeGreaterThanOrEqual(saved.unrelated[mode === "horizontal" ? "x" : "y"]);
    expect(expanded.child[mode === "horizontal" ? "x" : "y"]).toBeGreaterThanOrEqual(saved.child[mode === "horizontal" ? "x" : "y"]);
    for (const id of groups[0].foldable) for (const other of Object.keys(expanded)) if (id !== other)
      expect(positionsOverlap(expanded[id], expanded[other], mode, gapKind(f, id, other))).toBe(false);
    expect(expandedPartnerPositions(f, groups, new Set(["hub"]), expanded, mode)).toEqual(expanded);
    expect(saved).toEqual(before);
  });

  it("keeps every partner with children out of the accordion, even with multiple marriages", () => {
    const f = fixture();
    f.members.push({ ...newPerson(), id: "second-child", name: "Child", parents: ["hub", "current"] });
    const groups = partnerGroups(f);
    expect(groups[0].foldable).toEqual(["former"]);
    expect(groups[0].additional.map(u => u.id)).toEqual(["former"]);
    const collapsed = accordionFamily(f, groups, new Set());
    for (const id of ["ex", "current", "child", "second-child"]) expect(collapsed.members.find(p => p.id === id)).toEqual(f.members.find(p => p.id === id));
  });

  it.each(layoutModes)("renders a collapsed control and reveals a focused former partner in %s", layout => {
    const noop = () => {};
    const props: ComponentProps<typeof Tree> = {
      family: fixture(), layout, query: "", focus: null,
      onFocus: noop, onMove: async () => true, onMovePair: async () => true,
      onTidy: noop, onEdit: noop, onPartner: noop, onBranch: noop,
      onAncestor: noop, onChild: noop, onLink: noop, onSeparate: noop,
      onDeath: noop, onDynasty: noop, onJoinDynasty: noop, onRemove: noop,
    };
    const collapsed = renderToStaticMarkup(createElement(Tree, props));
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).not.toContain('data-person="current"');
    expect(collapsed).not.toContain('data-partner-for="hub"');
    expect(collapsed).not.toContain('data-partner-for="current"');
    expect(collapsed).toContain('data-person="child"');
    expect(collapsed).toContain('data-person="ex"');
    const expanded = renderToStaticMarkup(createElement(Tree, { ...props, focus: "former" }));
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).not.toContain('data-partner-for="hub"');
    expect(expanded).not.toContain('data-partner-for="current"');
    expect(expanded).toContain('data-person="ex"');
    expect(expanded).toContain('data-person="former"');
    expect(expanded).toContain('class="partner-accordion-list"');
    const preview = renderToStaticMarkup(createElement(Tree, { ...props, preview: true }));
    expect(preview).not.toContain('class="partner-accordion"');
    expect(preview).toContain('data-person="ex"');
  });

  it("only groups multiple partnerships with a divorce, keeping partners with children visible", () => {
    const f = fixture();
    const groups = partnerGroups(f);
    expect(groups).toHaveLength(1);
    expect(groups[0].primary.id).toBe("ex");
    expect(groups[0].foldable).toEqual(["current", "former"]);
    f.unions[0].marriage = "unspecified";
    expect(partnerGroups(f)).toEqual([]);
  });

  it.each(layoutModes)("preserves stored data, children and coordinates across toggling and tidying in %s", mode => {
    const f = tidyLayout(fixture(), mode);
    const before = structuredClone(f);
    const groups = partnerGroups(f);
    const collapsed = accordionFamily(f, groups, new Set());
    expect(collapsed.members.map(p => p.id)).toEqual(["hub", "ex", "child", "unrelated"]);
    expect(collapsed.members.find(p => p.id === "child")!.parents).toEqual(["hub", "ex"]);
    const positions = layoutFamily(f, mode, null).positions;
    const scene = layoutFamily(collapsed, mode, null, positions);
    for (const p of collapsed.members) expect(scene.positions[p.id]).toEqual(positions[p.id]);
    expect(scene.singles).toHaveLength(0);

    expect(accordionFamily(f, groups, new Set(["hub"]))).toBe(f);
    expect(f).toEqual(before);
    expect(tidyLayout(f, mode)).toEqual(f);
  });

  it("does not hide independent ancestry, single-parent children or other partners", () => {
    for (const reason of ["ancestry", "child", "partner"]) {
      const f = fixture();
      if (reason === "ancestry") f.members.find(p => p.id === "ex")!.parents = ["unrelated"];
      if (reason === "child") f.members.find(p => p.id === "child")!.parents = ["ex"];
      if (reason === "partner") f.unions.push({ id: "other", a: "ex", b: "unrelated", status: "active", ended: false });
      const groups = partnerGroups(f);
      expect(groups.find(g => g.personId === "hub")!.foldable).not.toContain("ex");
      const view = accordionFamily(f, groups, new Set());
      expect(view.members.find(p => p.id === "ex")).toBeDefined();
      expect(view.members.find(p => p.id === "child")!.parents).toEqual(f.members.find(p => p.id === "child")!.parents);
    }
  });
});
