import { describe, expect, it } from "vitest";
import { accordionFamily, partnerGroups } from "../src/partnerAccordion";
import { newPerson, type Family } from "../src/domain";
import { layoutFamily, layoutModes, tidyLayout } from "../src/layout";
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
    expect(collapsed).toContain('data-person="current"');
    expect(collapsed).toContain('data-person="child"');
    expect(collapsed).not.toContain('data-person="ex"');
    const expanded = renderToStaticMarkup(createElement(Tree, { ...props, focus: "ex" }));
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).toContain('data-person="ex"');
    expect(expanded).toContain('data-person="former"');
    expect(expanded).toContain('class="partner-accordion-list"');
    const preview = renderToStaticMarkup(createElement(Tree, { ...props, preview: true }));
    expect(preview).not.toContain('class="partner-accordion"');
    expect(preview).toContain('data-person="ex"');
  });

  it("only groups multiple partnerships with a divorce, keeping the current partner visible", () => {
    const f = fixture();
    const groups = partnerGroups(f);
    expect(groups).toHaveLength(1);
    expect(groups[0].primary.id).toBe("current");
    expect(groups[0].foldable).toEqual(["ex", "former"]);
    f.unions[0].marriage = "unspecified";
    expect(partnerGroups(f)).toEqual([]);
  });

  it.each(layoutModes)("preserves stored data, children and coordinates across toggling and tidying in %s", mode => {
    const f = tidyLayout(fixture(), mode);
    const before = structuredClone(f);
    const groups = partnerGroups(f);
    const collapsed = accordionFamily(f, groups, new Set());
    expect(collapsed.members.map(p => p.id)).toEqual(["hub", "current", "child", "unrelated"]);
    expect(collapsed.members.find(p => p.id === "child")!.parents).toEqual(["hub"]);
    const positions = layoutFamily(f, mode, null).positions;
    const scene = layoutFamily(collapsed, mode, null, positions);
    for (const p of collapsed.members) expect(scene.positions[p.id]).toEqual(positions[p.id]);
    expect(scene.singles).toHaveLength(1);
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
