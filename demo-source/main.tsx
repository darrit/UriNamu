import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Tree from "../../../src/Tree";
import { unionKey, type Family, type Person, type Union } from "../../../src/domain";
import { setLocale } from "../../../src/i18n";
import { preserveLayout, tidyLayout, type Layout, type Point } from "../../../src/layout";
import { layoutModes } from "../../../src/layout/types";
import "../../../src/style.css";
import "./preview.css";

function member(name: string, born: string, parents: string[] = []): Person {
  const [firstName, lastName] = name.split(" ");
  return {
    id: firstName.toLowerCase(),
    name,
    firstName,
    lastName,
    born,
    died: "",
    place: "",
    bio: "",
    gender: "",
    appearance: "normal",
    photo: "",
    parents,
  };
}

function marriage(a: string, b: string, marriedOn: string): Union {
  return {
    id: unionKey(a, b),
    a,
    b,
    status: "active",
    marriage: "married",
    marriedOn,
    ended: false,
  };
}

const example = preserveLayout(null, {
  version: 2,
  name: "Example family",
  members: [
    member("Ada Park", "1948"),
    member("Theo Reed", "1946"),
    member("Jin Kim", "1975"),
    member("Nora Reed", "1977", ["ada", "theo"]),
    member("Mina Kim", "2006", ["jin", "nora"]),
    member("Leo Kim", "2010", ["jin", "nora"]),
  ],
  unions: [marriage("ada", "theo", "1971"), marriage("jin", "nora", "2002")],
});

const labels: Record<Layout, string> = {
  classic: "Classic",
  horizontal: "Horizontal",
  tapestry: "Tapestry",
  chart: "Chart",
};

const idle = () => {};

function LayoutCanvas({ layout, active }: { layout: Layout; active: boolean }) {
  const [family, setFamily] = useState<Family>(example);
  const [focus, setFocus] = useState<string | null>(null);

  async function move(points: Record<string, Point>) {
    setFamily((current) => ({
      ...current,
      members: current.members.map((person) => {
        const point = points[person.id];
        return point
          ? { ...person, positions: { ...person.positions, [layout]: point } }
          : person;
      }),
    }));
    return true;
  }

  return (
    <div className="demo-tree" inert={!active}>
      <Tree
        family={family}
        layout={layout}
        query=""
        focus={focus}
        showPartnerSlots={false}
        onFocus={setFocus}
        onMove={(id, point) => move({ [id]: point })}
        onMovePair={(_, points) => move(points)}
        onTidy={() => setFamily((current) => tidyLayout(current, layout, false))}
        onEdit={idle}
        onPartner={idle}
        onBranch={idle}
        onAncestor={idle}
        onChild={idle}
        onLink={idle}
        onSeparate={idle}
        onDeath={idle}
        onDynasty={idle}
        onJoinDynasty={idle}
        onRemove={idle}
      />
    </div>
  );
}

function LayoutDemo() {
  const [layout, setLayout] = useState<Layout>("classic");
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewport.current!;
    // Ordinary wheel gestures still scroll the page. Modified gestures zoom the tree.
    const passPageScroll = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    element.addEventListener("wheel", passPageScroll, { capture: true, passive: true });
    return () => element.removeEventListener("wheel", passPageScroll, true);
  }, []);

  return (
    <div className="layout-demo">
      <div className="layout-tools">
        <div className="layout-options" role="radiogroup" aria-label="Tree layout">
          {layoutModes.map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="layout"
                checked={layout === mode}
                onChange={() => setLayout(mode)}
              />
              <span>{labels[mode]}</span>
            </label>
          ))}
        </div>
        <p id="layout-description">
          Drag people or the background. Zoom with +/− or Ctrl/⌘ + scroll.
        </p>
      </div>
      <div
        ref={viewport}
        className="demo-viewport"
        role="region"
        aria-label="Fictional family tree"
        aria-describedby="layout-description family-description"
        onContextMenuCapture={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
            event.stopPropagation();
        }}
      >
        <span id="family-description" className="visually-hidden">
          Ada Park and Theo Reed are Nora Reed’s parents. Nora Reed and Jin Kim
          are the parents of Mina and Leo Kim.
        </span>
        {/* Each view stays measured and keeps its own camera and person positions. */}
        {layoutModes.map((mode) => (
          <LayoutCanvas key={mode} layout={mode} active={mode === layout} />
        ))}
      </div>
    </div>
  );
}

setLocale("en");
createRoot(document.getElementById("demo")!).render(<LayoutDemo />);
