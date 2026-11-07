import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Tree from "../../../src/Tree";
import { unionKey, type Family, type Person, type Union } from "../../../src/domain";
import { locales, setLocale, t, type Locale, type MessageKey } from "../../../src/i18n";
import {
  blockersAround,
  freePosition,
  personFootprint,
  preserveLayout,
  tidyLayout,
  type Layout,
  type Point,
} from "../../../src/layout";
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

const exampleFamily: Family = {
  version: 2,
  name: "Example family",
  members: [
    member("Clara Weber", "1948-04-19"),
    member("Daniel Reed", "1946"),
    member("Ren Sato", "1975-09-08"),
    member("Sofia Reed", "1977", ["clara", "daniel"]),
    member("Mia Reed", "2006-02-12", ["ren", "sofia"]),
    member("Leo Sato", "2010", ["ren", "sofia"]),
  ],
  unions: [marriage("clara", "daniel", "1971-05-22"), marriage("ren", "sofia", "2002")],
};

// The shared wedding label checks an 80 px wide box. Keep room on both
// axes so it stays centered when a couple is dragged into a diagonal layout.
const weddingGap = 88;

const previewBlockers: typeof blockersAround = (
  family, positions, id, layout, skip = [],
) => {
  const wedding = family.unions.find(
    (union) => union.marriedOn && (union.a === id || union.b === id),
  );
  const partner = wedding && (wedding.a === id ? wedding.b : wedding.a);
  const blockers = blockersAround(family, positions, id, layout, [
    ...skip,
    ...(partner ? [partner] : []),
  ]);
  if (partner && !skip.includes(partner) && positions[partner]) {
    const at = positions[partner];
    const { w, h } = personFootprint(at, layout);
    blockers.push({ at, separation: { x: w + weddingGap, y: h + weddingGap } });
  }
  return blockers;
};

function withPositions(family: Family, layout: Layout, positions: Record<string, Point>): Family {
  return {
    ...family,
    members: family.members.map((person) => {
      const point = positions[person.id];
      return point ? { ...person, positions: { ...person.positions, [layout]: point } } : person;
    }),
  };
}

function spacePreview(family: Family, layout: Layout): Family {
  const positions: Record<string, Point> = {};
  for (const person of family.members) {
    positions[person.id] = freePosition(
      person.positions![layout]!,
      previewBlockers(family, positions, person.id, layout),
      layout,
    );
  }
  return withPositions(family, layout, positions);
}

const example = layoutModes.reduce(spacePreview, preserveLayout(null, exampleFamily));

const labels: Record<Layout, MessageKey> = {
  classic: "layoutClassic",
  horizontal: "layoutHorizontal",
  tapestry: "layoutTapestry",
  chart: "layoutChart",
};

const copy = {
  de: {
    layout: "Baumansicht",
    hint: "Ziehe Personen oder den Hintergrund. Zoome mit +/− oder Strg/⌘ und Mausrad.",
    region: "Fiktiver Stammbaum",
    family: "Beispielfamilie",
    relations: "Clara Weber und Daniel Reed sind die Eltern von Sofia Reed. Sofia Reed und Ren Sato sind die Eltern von Mia Reed und Leo Sato.",
  },
  en: {
    layout: "Tree layout",
    hint: "Drag people or the background. Zoom with +/− or Ctrl/⌘ + scroll.",
    region: "Fictional family tree",
    family: "Example family",
    relations: "Clara Weber and Daniel Reed are Sofia Reed’s parents. Sofia Reed and Ren Sato are the parents of Mia Reed and Leo Sato.",
  },
  ja: {
    layout: "家系図の表示形式",
    hint: "人物や背景をドラッグして移動します。拡大・縮小は＋／−、またはCtrl／⌘を押しながらスクロールします。",
    region: "架空の家系図",
    family: "サンプルの家系図",
    relations: "Clara WeberとDaniel ReedはSofia Reedの両親です。Sofia ReedとRen SatoはMia ReedとLeo Satoの両親です。",
  },
  ko: {
    layout: "가계도 보기 방식",
    hint: "인물이나 배경을 끌어 이동하세요. +/− 버튼이나 Ctrl/⌘를 누른 채 스크롤해 확대하거나 축소할 수 있습니다.",
    region: "가상의 가계도",
    family: "예시 가족",
    relations: "Clara Weber와 Daniel Reed는 Sofia Reed의 부모입니다. Sofia Reed와 Ren Sato는 Mia Reed와 Leo Sato의 부모입니다.",
  },
};

const idle = () => {};

function LayoutCanvas({ layout, active, name }: { layout: Layout; active: boolean; name: string }) {
  const [family, setFamily] = useState<Family>(example);
  const [focus, setFocus] = useState<string | null>(null);
  const namedFamily = useMemo(() => ({ ...family, name }), [family, name]);
  async function move(points: Record<string, Point>) {
    setFamily((current) => withPositions(current, layout, points));
    return true;
  }

  return (
    <div className="demo-tree" inert={!active}>
      <Tree
        family={namedFamily}
        layout={layout}
        query=""
        focus={focus}
        showPartnerSlots={false}
        onFocus={setFocus}
        onMove={(id, point) => move({ [id]: point })}
        onMovePair={(_, points) => move(points)}
        movementBlockers={previewBlockers}
        onTidy={() => setFamily((current) => spacePreview(tidyLayout(current, layout, false), layout))}
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
  const [language, setLanguage] = useState<Locale>("en");
  const strings = copy[language];
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function changeLanguage(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== window.parent ||
          event.data?.type !== "urinamu-language") return;
      const locale = locales.find((value) => value === event.data.locale);
      if (!locale) return;
      setLocale(locale);
      setLanguage(locale);
      document.documentElement.lang = locale;
      document.title = `UriNamu · ${t("navTree")}`;
    }
    window.addEventListener("message", changeLanguage);
    if (window.parent !== window) {
      window.parent.postMessage({ type: "urinamu-preview-ready" }, location.origin);
    }
    return () => window.removeEventListener("message", changeLanguage);
  }, []);

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
        <div className="layout-options" role="radiogroup" aria-label={strings.layout}>
          {layoutModes.map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="layout"
                checked={layout === mode}
                onChange={() => setLayout(mode)}
              />
              <span>{t(labels[mode])}</span>
            </label>
          ))}
        </div>
        <p id="layout-description">{strings.hint}</p>
      </div>
      <div
        ref={viewport}
        className="demo-viewport"
        role="region"
        aria-label={strings.region}
        aria-describedby="layout-description family-description"
        onContextMenuCapture={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
            event.stopPropagation();
        }}
      >
        <span id="family-description" className="visually-hidden">{strings.relations}</span>
        {/* Each view stays measured and keeps its own camera and person positions. */}
        {layoutModes.map((mode) => (
          <LayoutCanvas key={mode} layout={mode} active={mode === layout} name={strings.family} />
        ))}
      </div>
    </div>
  );
}

setLocale("en");
createRoot(document.getElementById("demo")!).render(<LayoutDemo />);
