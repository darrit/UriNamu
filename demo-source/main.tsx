import { useState } from "react";
import { createRoot } from "react-dom/client";
import Tree from "../../../src/Tree";
import { unionKey, type Family, type Person, type Union } from "../../../src/domain";
import { setLocale } from "../../../src/i18n";
import type { Layout } from "../../../src/layout";
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

const family: Family = {
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
};

const layouts: Record<Layout, { label: string; description: string }> = {
  classic: { label: "Classic", description: "Portrait cards arranged by generation from top to bottom." },
  horizontal: { label: "Horizontal", description: "Generations run from left to right." },
  tapestry: { label: "Tapestry", description: "Framed portraits with ribbons for names and dates." },
  chart: { label: "Chart", description: "Compact text cards show names and dates in place of portraits." },
};

const idle = () => {};
const refuse = async () => false;

function LayoutDemo() {
  const [layout, setLayout] = useState<Layout>("classic");
  const [large, setLarge] = useState(false);

  return (
    <div className="layout-demo">
      <div className="layout-tools">
        <div className="layout-controls">
          <div className="layout-options" role="radiogroup" aria-label="Tree layout">
            {layoutModes.map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="layout"
                  checked={layout === mode}
                  onChange={() => setLayout(mode)}
                />
                <span>{layouts[mode].label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="large-toggle"
            aria-pressed={large}
            onClick={() => setLarge((value) => !value)}
          >
            Larger view
          </button>
        </div>
        <p id="layout-description" role="status">
          {layouts[layout].description}
          {large && " Scroll to explore the enlarged tree."}
        </p>
      </div>
      <div
        className="demo-viewport"
        role="region"
        aria-label="Fictional family tree"
        aria-describedby="layout-description family-description"
        tabIndex={large ? 0 : undefined}
      >
        <span id="family-description" className="visually-hidden">
          Ada Park and Theo Reed are Nora Reed’s parents. Nora Reed and Jin Kim
          are the parents of Mina and Leo Kim.
        </span>
        <div className={large ? "demo-tree demo-tree-large" : "demo-tree"} inert>
          <Tree
            family={family}
            layout={layout}
            query=""
            focus={null}
            preview
            showPartnerSlots={false}
            onFocus={idle}
            onMove={refuse}
            onMovePair={refuse}
            onTidy={idle}
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
      </div>
    </div>
  );
}

setLocale("en");
createRoot(document.getElementById("demo")!).render(<LayoutDemo />);
