import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize, Focus, ArrowUpLeft, Shrink } from "lucide-react";
import {
  type Family,
  type Person,
  symbol,
  years,
  displayName,
  matchesQuery,
  childBranchControl,
} from "./domain";
import {
  flowingConnector,
  ancestorSlotsFor,
  layoutFamily,
  preserveLayout,
  freePosition,
  freePair,
  blockersAround,
  dynastyRegion,
  type Layout,
  type Point,
} from "./layout";
import { dateLabel } from "./dates";
import { getLocale, localeTag, t } from "./i18n";
export function Portrait({ p }: { p: Person }) {
  return (
    <span
      className={`portrait${p.died ? " portrait--deceased" : ""}`}
      title={p.died ? t("diedOn", { date: dateLabel(p.died) }) : undefined}
    >
      {p.photo ? (
        <img
          src={p.photo}
          alt={`${displayName(p)}${p.died ? ` – ${t("diedOn", { date: dateLabel(p.died) })}` : ""}`}
          draggable={false}
        />
      ) : (
        <span className="portrait-initials">
          {p.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
      )}
    </span>
  );
}
export default function Tree({
  family,
  layout,
  query,
  focus,
  onFocus,
  onMove,
  onMovePair,
  onTidy,
  onEdit,
  onPartner,
  onBranch,
  onAncestor,
  onChild,
  onSeparate,
  onDeath,
  onDynasty,
  onJoinDynasty,
  onRemove,
  showPartnerSlots = true,
}: {
  family: Family;
  layout: Layout;
  query: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
  onMove: (id: string, point: Point) => Promise<boolean>;
  onMovePair: (ids: [string, string], points: Record<string, Point>) => Promise<boolean>;
  onTidy: () => void;
  onEdit: (p: Person) => void;
  onPartner: (id: string) => void;
  onBranch: (id: string) => void;
  onAncestor: (id: string, index: number) => void;
  onChild: (parentId: string) => void;
  onSeparate: (id: string) => void;
  onDeath: (id: string) => void;
  onDynasty: (id: string) => void;
  onJoinDynasty: (personId: string, founderId: string) => void;
  onRemove: (id: string) => void;
  showPartnerSlots?: boolean;
}) {
  const placedFamily = useMemo(() => preserveLayout(null, family), [family]);
  const [moving, setMoving] = useState<Record<string, Point>>({});
  const scene = useMemo(
    () =>
      layoutFamily(placedFamily, layout, null, moving, {
        partnerSlots: showPartnerSlots !== false,
      }),
    [placedFamily, layout, moving, showPartnerSlots],
  );
  const personDrag = useRef<{
    id: string;
    client: Point;
    start: Point;
    point: Point;
    moved: boolean;
  } | null>(null);
  const coupleDrag = useRef<{
    a: string;
    b: string;
    client: Point;
    startA: Point;
    startB: Point;
    pointA: Point;
    pointB: Point;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef<string | null>(null);
  const savingMove = useRef(false);
  const container = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const [ancestorFor, setAncestorFor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        document
          .querySelector<HTMLButtonElement>(
            `[data-person="${CSS.escape(menu.id)}"]`,
          )
          ?.focus();
      }
      if (e.key === "Tab") setMenu(null);
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        const buttons = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        buttons[
          (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
            buttons.length
        ]?.focus();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close, true);
    };
  }, [menu]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize((size) =>
        size.w === r.width && size.h === r.height
          ? size
          : { w: r.width, h: r.height },
      );
    });
    if (container.current) ro.observe(container.current);
    return () => ro.disconnect();
  }, []);
  const fit = () => {
    const b = scene.bounds,
      k = Math.max(
        0.08,
        Math.min(1, (size.w - 60) / b.width, (size.h - 140) / b.height),
      );
    setView({
      k,
      x: (size.w - b.width * k) / 2 - b.x * k,
      y: (size.h - b.height * k) / 2 - b.y * k + 10,
    });
  };
  useEffect(() => {
    if (focus && scene.positions[focus]) {
      const p = scene.positions[focus];
      setView((v) => {
        const k = v.k;
        return {
          k,
          x: size.w / 2 - (p.x + 90) * k,
          y: size.h / 2 - (p.y + 60) * k,
        };
      });
    } else fit();
  }, [layout, size.w, size.h, focus]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const focusPerson = (id: string) => {
    if (focus === id) {
      const p = scene.positions[id];
      setView((v) => ({
        ...v,
        x: size.w / 2 - (p.x + 90) * v.k,
        y: size.h / 2 - (p.y + 60) * v.k,
      }));
    } else onFocus(id);
  };
  const zoom = (factor: number, anchor = { x: size.w / 2, y: size.h / 2 }) =>
    setView((v) => {
      const k = Math.max(0.08, Math.min(2.5, v.k * factor));
      return {
        k,
        x: anchor.x - ((anchor.x - v.x) * k) / v.k,
        y: anchor.y - ((anchor.y - v.y) * k) / v.k,
      };
    });
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const delta =
        e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.h : 1);
      zoom(Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.0015), {
        x: e.clientX - rect.left - el.clientLeft,
        y: e.clientY - rect.top - el.clientTop,
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [size]);
  const ancestorChild = family.members.find((p) => p.id === ancestorFor);
  useEffect(() => {
    if (ancestorFor && (!ancestorChild || ancestorChild.parents.length >= 2))
      setAncestorFor(null);
  }, [ancestorFor, ancestorChild]);
  const ancestorSlots = ancestorFor
    ? ancestorSlotsFor(family, scene.positions, ancestorFor, layout, scene.slots)
    : [];
  const curve = (a: Point, b: Point) => flowingConnector(a, b);
  const menuPerson = menu
    ? family.members.find((person) => person.id === menu.id)
    : undefined;
  const menuItems = (() => {
    if (!menu || !menuPerson) return [];
    const close = (run: () => void) => {
      run();
      setMenu(null);
    };
    const active = family.unions.filter(
      (union) =>
        union.status === "active" &&
        (union.a === menuPerson.id || union.b === menuPerson.id),
    );
    const items = [
      {
        key: "death",
        group: "other" as const,
        label: menuPerson.died ? t("changeDeathShort") : t("markDeceased"),
        nested: false,
        onClick: () => close(() => onDeath(menuPerson.id)),
      },
      {
        key: "partner",
        group: "add" as const,
        plus: true,
        label: t("addNewPartner"),
        nested: false,
        disabled: active.length > 0,
        onClick: () => close(() => onPartner(menuPerson.id)),
      },
      {
        key: "single-child",
        group: "add" as const,
        plus: true,
        danger: false,
        disabled: false,
        label: t("addChild"),
        nested: false,
        onClick: () => close(() => onChild(menuPerson.id)),
      },
      ...family.unions
        .filter(
          (union) => union.a === menuPerson.id || union.b === menuPerson.id,
        )
        .map((union) => {
          const other = family.members.find(
            (person) =>
              person.id === (union.a === menuPerson.id ? union.b : union.a),
          );
          return {
            key: "child-" + union.id,
            group: "add" as const,
            plus: union.marriage !== "divorced",
            nested: union.marriage === "divorced",
            danger: false,
            disabled: false,
            label: t("childWith", { name: displayName(other) }),
            onClick: () => close(() => onBranch(union.id)),
          };
        }),
      ...active.map((union) => ({
        key: union.id,
        group: "other" as const,
        label: t("recordDivorce"),
        nested: false,
        onClick: () => close(() => onSeparate(union.id)),
      })),
      {
        key: "dynasty",
        group: "other" as const,
        label: menuPerson.dynasty
          ? t("editDynasty", { name: menuPerson.dynasty.name })
          : t("setDynasty", { name: displayName(menuPerson) }),
        nested: false,
        onClick: () => close(() => onDynasty(menuPerson.id)),
      },
      ...family.unions
        .filter(
          (union) => union.a === menuPerson.id || union.b === menuPerson.id,
        )
        .flatMap((union) => {
          const other = family.members.find(
            (person) =>
              person.id === (union.a === menuPerson.id ? union.b : union.a),
          );
          if (!other?.dynasty) return [];
          const joined = menuPerson.dynastyWith?.includes(other.id);
          return [
            {
              key: "join-" + other.id,
              group: "other" as const,
              label: joined
                ? t("leaveDynasty", { name: other.dynasty.name })
                : t("joinDynasty", { name: other.dynasty.name }),
              nested: false,
              onClick: () => close(() => onJoinDynasty(menuPerson.id, other.id)),
            },
          ];
        }),
      {
        key: "ancestor",
        group: "add" as const,
        plus: true,
        label:
          menuPerson.parents.length >= 2
            ? t("parentsComplete")
            : ancestorFor === menuPerson.id
              ? t("stopAncestors")
              : t("addAncestors"),
        nested: false,
        disabled: menuPerson.parents.length >= 2,
        onClick: () =>
          close(() => {
            setAncestorFor(ancestorFor === menuPerson.id ? null : menuPerson.id);
            focusPerson(menuPerson.id);
          }),
      },
      {
        key: "profile",
        group: "other" as const,
        label: t("openProfile"),
        nested: false,
        onClick: () => close(() => onEdit(menuPerson)),
      },
      {
        key: "remove",
        group: "other" as const,
        danger: true,
        label: t("removePerson"),
        nested: false,
        onClick: () => close(() => onRemove(menuPerson.id)),
      },
    ].sort((a, b) => {
      if (a.key === "remove") return 1;
      if (b.key === "remove") return -1;
      return a.group === b.group
        ? a.label.localeCompare(b.label, localeTag[getLocale()])
        : a.group === "add"
          ? -1
          : 1;
    });
    const nested = items.filter((item) => item.nested);
    const ordered = items.filter((item) => !item.nested);
    const childAt = ordered.findIndex((item) => item.key === "single-child");
    ordered.splice(
      childAt < 0 ? ordered.length : childAt + 1,
      0,
      ...nested.sort((a, b) =>
        a.label.localeCompare(b.label, localeTag[getLocale()]),
      ),
    );
    return ordered.map((item, index) => ({
      ...item,
      split:
        item.key === "remove" ||
        (item.group === "other" && ordered[index - 1]?.group === "add"),
    }));
  })();
  const dynasties = family.members.flatMap((person) => {
    if (!person.dynasty) return [];
    const region = dynastyRegion(family, person, scene.positions, layout);
    if (!region) return [];
    return [
      {
        id: person.id,
        dynasty: person.dynasty,
        x: region.rect.x,
        y: region.rect.y,
        w: region.rect.w,
        h: region.rect.h,
        area: region.rect.w * region.rect.h,
      },
    ];
  });
  dynasties.sort((a, b) => b.area - a.area);
  return (
    <div
      className={`canvas ${layout}`}
      ref={container}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button,[role="menu"]')) return;
        e.preventDefault();
        drag.current = { x: e.clientX, y: e.clientY, tx: view.x, ty: view.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d)
          setView((v) => ({
            ...v,
            x: d.tx + e.clientX - d.x,
            y: d.ty + e.clientY - d.y,
          }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="canvas-meta">
        <strong>{family.name}</strong>
        <span>{t("memberCount", { count: family.members.length })}</span>
        {focus && (
          <button onClick={() => onFocus(null)}>
            <ArrowUpLeft size={12} /> {t("overview")}
          </button>
        )}
      </div>
      <div className="legend">
        <i /> {t("legendPartnership")} <i className="child" /> {t("legendChildren")}{" "}
        <span>╫ {t("legendSeparated")}</span>
      </div>
      {layout === "tapestry" && (
        <div className="tapestry-title">
          <span className="wordmark-uri">URI</span>{" "}
          <span className="wordmark-namu">NAMU</span> · {t("ourRoots")}
        </div>
      )}
      <div
        className="world"
        style={{
          left: view.x / view.k,
          top: view.y / view.k,
          zoom: view.k,
        }}
      >
        {dynasties.map((region) => (
          <div
            key={region.id}
            className="dynasty-region"
            role="img"
            aria-label={region.dynasty.name}
            style={{
              left: region.x,
              top: region.y,
              width: region.w,
              height: region.h,
            }}
          >
            {region.dynasty.logo && (
              <img
                className="dynasty-watermark"
                src={region.dynasty.logo}
                alt=""
                aria-hidden="true"
              />
            )}
            <div
              className={`dynasty-badge ${region.dynasty.corner}${
                region.dynasty.logo ? "" : " plain"
              }`}
            >
              {region.dynasty.logo && (
                <img src={region.dynasty.logo} alt="" />
              )}
              <span>{region.dynasty.name}</span>
            </div>
          </div>
        ))}
        <svg className="edges" width="1" height="1" aria-hidden="true">
          {scene.unions.map((u) => (
            <g key={u.id} data-relationship={u.id}>
              <path
                className={u.separated ? "separated" : "partnership"}
                d={u.partnerPath || curve(u.a, u.b)}
              />
              <path
                className="partnership-hit"
                d={u.partnerPath || curve(u.a, u.b)}
                aria-label={t("movePair")}
                onPointerDown={(e) => {
                  if (e.button !== 0 || savingMove.current) return;
                  const stored = family.unions.find((item) => item.id === u.id);
                  if (!stored) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const startA = scene.positions[stored.a],
                    startB = scene.positions[stored.b];
                  coupleDrag.current = {
                    a: stored.a,
                    b: stored.b,
                    client: { x: e.clientX, y: e.clientY },
                    startA,
                    startB,
                    pointA: startA,
                    pointB: startB,
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = coupleDrag.current;
                  const stored = family.unions.find((item) => item.id === u.id);
                  if (!d || !stored || d.a !== stored.a) return;
                  e.stopPropagation();
                  const dx = (e.clientX - d.client.x) / view.k,
                    dy = (e.clientY - d.client.y) / view.k;
                  if (!d.moved && Math.hypot(dx, dy) < 4) return;
                  d.moved = true;
                  d.pointA = { x: d.startA.x + dx, y: d.startA.y + dy };
                  d.pointB = { x: d.startB.x + dx, y: d.startB.y + dy };
                  setMoving({ [d.a]: d.pointA, [d.b]: d.pointB });
                }}
                onPointerUp={async (e) => {
                  const d = coupleDrag.current;
                  const stored = family.unions.find((item) => item.id === u.id);
                  if (!d || !stored || d.a !== stored.a) return;
                  e.stopPropagation();
                  coupleDrag.current = null;
                  if (!d.moved) return;
                  const placed = freePair(
                    d.pointA,
                    d.pointB,
                    blockersAround(family, scene.positions, d.a, layout, [d.b]),
                    layout,
                    blockersAround(family, scene.positions, d.b, layout, [d.a]),
                  );
                  setMoving({ [d.a]: placed.a, [d.b]: placed.b });
                  savingMove.current = true;
                  try {
                    await onMovePair([d.a, d.b], {
                      [d.a]: placed.a,
                      [d.b]: placed.b,
                    });
                  } finally {
                    savingMove.current = false;
                    setMoving({});
                  }
                }}
                onPointerCancel={() => {
                  coupleDrag.current = null;
                  setMoving({});
                }}
              />
              {u.separated && (
                <path
                  className="strike"
                  d={`M${u.joint.x - 6},${u.joint.y - 9}l12,18m-5,-18l12,18`}
                />
              )}
              {u.children.map((p, i) => (
                <path
                  key={i}
                  className="child"
                  d={u.childPaths?.[i] || curve(u.joint, p)}
                />
              ))}
            </g>
          ))}
          {ancestorSlots.map((s) => (
            <path
              key={"ancestor" + s.personId + s.index}
              className="ancestor-edge"
              d={curve(
                { x: s.x + 90, y: s.y + 60 },
                {
                  x: scene.positions[s.personId].x + 90,
                  y: scene.positions[s.personId].y,
                },
              )}
            />
          ))}
          {scene.singles.map((s, i) => (
            <path key={"s" + i} className="child" d={curve(s.a, s.b)} />
          ))}
        </svg>
        {family.members
          .map((p) => {
            const pos = scene.positions[p.id];
            return (
              <button
                key={p.id}
                data-person={p.id}
                className={`person ${focus === p.id ? "selected" : ""}${
                  matchesQuery(p, query) ? "" : " search-miss"
                }`}
                style={{ left: pos.x, top: pos.y }}
                title={t("personTitle", { name: displayName(p) })}
                onPointerDown={(e) => {
                  if (e.button !== 0 || savingMove.current) return;
                  e.stopPropagation();
                  clearTimeout(timer.current);
                  suppressClick.current = null;
                  personDrag.current = {
                    id: p.id,
                    client: { x: e.clientX, y: e.clientY },
                    start: pos,
                    point: pos,
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = personDrag.current;
                  if (!d || d.id !== p.id) return;
                  e.stopPropagation();
                  const dx = e.clientX - d.client.x,
                    dy = e.clientY - d.client.y;
                  if (!d.moved && Math.hypot(dx, dy) < 4) return;
                  d.moved = true;
                  d.point = {
                    x: d.start.x + dx / view.k,
                    y: d.start.y + dy / view.k,
                  };
                  setMoving({ [p.id]: d.point });
                }}
                onPointerUp={async (e) => {
                  const d = personDrag.current;
                  if (!d || d.id !== p.id) return;
                  e.stopPropagation();
                  personDrag.current = null;
                  if (!d.moved) return;
                  suppressClick.current = p.id;
                  const point = freePosition(
                    d.point,
                    blockersAround(family, scene.positions, p.id, layout),
                    layout,
                  );
                  setMoving({ [p.id]: point });
                  savingMove.current = true;
                  try {
                    await onMove(p.id, point);
                  } finally {
                    savingMove.current = false;
                    setMoving({});
                  }
                }}
                onPointerCancel={() => {
                  personDrag.current = null;
                  setMoving({});
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearTimeout(timer.current);
                  setMenu({ id: p.id, x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  clearTimeout(timer.current);
                  if (suppressClick.current === p.id) {
                    suppressClick.current = null;
                    return;
                  }
                  if (e.detail < 2)
                    timer.current = setTimeout(() => focusPerson(p.id), 220);
                }}
                onDoubleClick={() => {
                  clearTimeout(timer.current);
                  onEdit(p);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "ContextMenu" ||
                    (e.shiftKey && e.key === "F10")
                  ) {
                    e.preventDefault();
                    clearTimeout(timer.current);
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({
                      id: p.id,
                      x: r.x + r.width / 2,
                      y: r.y + r.height / 2,
                    });
                    return;
                  }
                  if (e.key === "Enter") {
                    clearTimeout(timer.current);
                    e.preventDefault();
                    onEdit(p);
                  }
                  if (e.key === " ") {
                    e.preventDefault();
                    focusPerson(p.id);
                  }
                }}
              >
                {focus === p.id && (
                  <span className="focus-label">
                    <Focus size={11} /> {t("inFocus")}
                  </span>
                )}
                <Portrait p={p} />
                <span className="person-text">
                  <strong>
                    <span>{symbol(p)}</span> {displayName(p)}
                  </strong>
                  <small>{years(p)}</small>
                </span>
                {layout === "tapestry" && (
                  <svg
                    className="ribbon"
                    viewBox="0 0 240 78"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id={"paper" + p.id}>
                        <stop stopColor="#a88d60" />
                        <stop offset=".5" stopColor="#eddbb1" />
                        <stop offset="1" stopColor="#b79b6c" />
                      </linearGradient>
                      <path id={"curve" + p.id} d="M29 37 Q120 64 211 37" />
                    </defs>
                    <path
                      d="M3 7Q23 21 47 17L51 57Q27 56 5 42L17 29ZM237 7Q217 21 193 17L189 57Q213 56 235 42L223 29Z"
                      fill="#a88d60"
                    />
                    <path
                      d="M28 22L44 19L46 60L28 52ZM212 22L196 19L194 60L212 52Z"
                      fill="#715a3c"
                    />
                    <path
                      d="M25 16Q120 50 215 16L211 54Q120 87 29 54Z"
                      fill={`url(#paper${p.id})`}
                      stroke="#7a6240"
                    />
                    <text
                      fontSize={displayName(p).length > 24 ? 10 : 12}
                      textAnchor="middle"
                    >
                      <textPath href={"#curve" + p.id} startOffset="50%">
                        {symbol(p)} {displayName(p)}
                      </textPath>
                    </text>
                    <text x="120" y="62" textAnchor="middle" fontSize="9">
                      {years(p)}
                    </text>
                  </svg>
                )}
              </button>
            );
          })}
        {!query &&
          ancestorSlots.map((s) => (
            <button
              className="partner-slot ancestor-slot"
              key={"ancestor" + s.personId + s.index}
              style={{ left: s.x, top: s.y }}
              onClick={() => onAncestor(s.personId, s.index)}
            >
              <Plus size={23} /> {t("addAncestor")}
            </button>
          ))}
        {!query &&
          scene.slots.map((s) => (
            <button
              className="partner-slot"
              key={s.id}
              style={{ left: s.x, top: s.y }}
              aria-label={t("addPartner")}
              title={t("addPartner")}
              onClick={() => {
                // A single entered ancestor supplies the one remaining parent
                // through their partner slot, not through a duplicate placeholder.
                if (
                  ancestorChild?.parents.length === 1 &&
                  ancestorChild.parents[0] === s.id
                )
                  onAncestor(ancestorChild.id, 1);
                else onPartner(s.id);
              }}
              data-partner-for={s.id}
              data-ancestor-for={
                ancestorChild?.parents.length === 1 &&
                ancestorChild.parents[0] === s.id
                  ? ancestorChild.id
                  : undefined
              }
            >
              <Plus size={18} aria-hidden="true" />
              <span className="slot-label">{t("addPartner")}</span>
            </button>
          ))}
        {!query &&
          scene.unions
            .filter((drawn) => {
              const stored = family.unions.find((item) => item.id === drawn.id);
              return !!stored && childBranchControl(family, stored) !== "hidden";
            })
            .map((u) => (
            <button
              key={u.id}
              data-union={u.id}
              className={u.ended ? "branch-end" : "branch-add"}
              style={{
                left: u.marker.x,
                top: u.marker.y,
              }}
              onClick={() => onBranch(u.id)}
              title={t("childOrClose")}
            >
              {u.ended ? t("noChildren") : <Plus size={15} />}
            </button>
          ))}
      </div>
      {family.members.length === 0 && (
        <div className="empty">
          {t("emptyTree")
            .split("\n")
            .map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
        </div>
      )}
      {query &&
        !family.members.some((p) => matchesQuery(p, query)) && (
          <div className="empty">{t("noneFound")}</div>
        )}
      <div className="canvas-hint">
        {t("canvasHint")}
      </div>
      {menu &&
        menuPerson &&
        createPortal(
          <div
            ref={menuRef}
            className="person-context"
            role="menu"
            aria-label={t("personActions")}
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 254)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 460)),
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="context-name">{displayName(menuPerson)}</div>
            {menuItems.map((item) => (
              <button
                key={item.key}
                role="menuitem"
                className={
                  [
                    item.danger ? "danger" : "",
                    item.split ? "context-split" : "",
                    item.nested ? "context-nested" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                disabled={item.disabled}
                onClick={item.onClick}
              >
                {item.plus && <Plus size={15} />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
      <div className="zoom">
        <button aria-label={t("zoomOut")} onClick={() => zoom(1 / 1.2)}>
          <Minus size={16} />
        </button>
        <output>{Math.round(view.k * 100)}%</output>
        <button aria-label={t("zoomIn")} onClick={() => zoom(1.2)}>
          <Plus size={16} />
        </button>
        <button aria-label={t("fitAll")} onClick={fit}>
          <Maximize size={16} />
        </button>
        <button aria-label={t("tidy")} title={t("tidy")} onClick={onTidy}>
          <Shrink size={16} />
        </button>
      </div>
    </div>
  );
}
