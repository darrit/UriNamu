import { TreeConnections } from "./tree/TreeConnections";
import { usePersonMenu } from "./tree/usePersonMenu";
import { useTreeViewport } from "./tree/useTreeViewport";
import { personMenuItems } from "./tree/personMenuItems";
import { Portrait } from "./Portrait";
export { Portrait } from "./Portrait";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Plus,
  Minus,
  Maximize,
  Focus,
  ArrowUpLeft,
  Shrink,
} from "lucide-react";
import {
  type Family,
  type Person,
  symbol,
  years,
  displayName,
  matchesQuery,
  chartSurnames,
  nameParts,
  childBranchControl,
} from "./domain";
import {
  ancestorSlotsFor,
  layoutFamily,
  preserveLayout,
  freePosition,
  blockersAround,
  dynastyRegion,
  personFootprint,
  type Layout,
  type Point,
} from "./layout";
import { dateLabel } from "./dates";
import { t } from "./i18n";
import { type PosterFrame } from "./poster";
import {
  accordionFamily,
  partnerGroups,
  expandedPartnerPositions,
} from "./partnerAccordion";

export default function Tree({
  family,
  layout,
  query,
  focus,
  onFocus,
  onMove,
  onMovePair,
  movementBlockers,
  transformViewport = false,
  onTidy,
  onEdit,
  onPartner,
  onBranch,
  onAncestor,
  onChild,
  onLink,
  onSeparate,
  onDeath,
  onDynasty,
  onJoinDynasty,
  onRemove,
  showPartnerSlots = true,
  showLinkPorts = false,
  guidePersonId = null,
  guide = null,
  preview = false,
  poster = null,
}: {
  family: Family;
  layout: Layout;
  query: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
  onMove: (id: string, point: Point) => Promise<boolean>;
  onMovePair: (
    ids: [string, string],
    points: Record<string, Point>,
  ) => Promise<boolean>;
  /** Custom spacing to enforce while dragging as well as on drop. */
  movementBlockers?: typeof blockersAround;
  /** Scale the rendered canvas as a whole for browsers with CSS zoom text issues. */
  transformViewport?: boolean;
  onTidy: () => void;
  onEdit: (p: Person) => void;
  onPartner: (id: string) => void;
  onBranch: (id: string) => void;
  onAncestor: (id: string, index: number) => void;
  onChild: (parentId: string) => void;
  onLink: (childId: string, parentId: string) => void;
  onSeparate: (id: string) => void;
  onDeath: (id: string) => void;
  onDynasty: (id: string) => void;
  onJoinDynasty: (personId: string, founderId: string) => void;
  onRemove: (id: string) => void;
  showPartnerSlots?: boolean;
  /** Guide still: the parent and child points stay visible. */
  showLinkPorts?: boolean;
  guidePersonId?: string | null;
  guide?: ReactNode;
  /** A still of the real canvas for the guide. No controls and no dragging. */
  preview?: boolean;
  /** One tile of a full-size print of this layout. */
  poster?: PosterFrame | null;
}) {
  const placedFamily = useMemo(() => preserveLayout(null, family), [family]);
  const [moving, setMoving] = useState<Record<string, Point>>({});
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(
    new Set(),
  );
  const groups = useMemo(() => partnerGroups(placedFamily), [placedFamily]);
  const openGroups = useMemo(() => {
    const open = new Set(expandedPartners);
    for (const group of groups)
      if (poster || preview || query || group.foldable.includes(focus ?? ""))
        open.add(group.personId);
    return open;
  }, [expandedPartners, groups, poster, preview, query, focus]);
  const visibleFamily = useMemo(
    () => accordionFamily(placedFamily, groups, openGroups),
    [placedFamily, groups, openGroups],
  );
  const allPositions = useMemo(() => {
    const saved = layoutFamily(
      placedFamily,
      layout,
      null,
      {},
      { partnerSlots: false },
    ).positions;
    const expanded =
      poster || preview
        ? saved
        : expandedPartnerPositions(
            placedFamily,
            groups,
            openGroups,
            saved,
            layout,
          );
    return { ...expanded, ...moving };
  }, [placedFamily, layout, moving, groups, openGroups, poster, preview]);
  const placePerson = (id: string, point: Point) =>
    freePosition(
      point,
      (movementBlockers ?? blockersAround)(family, allPositions, id, layout),
      layout,
    );
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const scene = useMemo(
    () =>
      layoutFamily(visibleFamily, layout, null, allPositions, {
        partnerSlots: showPartnerSlots !== false,
      }),
    [visibleFamily, layout, allPositions, showPartnerSlots],
  );
  const personDrag = useRef<{
    id: string;
    client: Point;
    start: Point;
    point: Point;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef<string | null>(null);
  const savingMove = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const [ancestorFor, setAncestorFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    id: string;
    toward: "parent" | "child";
    from: Point;
    to: Point;
    clientX: number;
    clientY: number;
  } | null>(null);
  const { menu, setMenu, menuRef } = usePersonMenu();
  const { container, view, setView, fit, focusPerson, zoom } = useTreeViewport({
    scene,
    layout,
    focus,
    onFocus,
    poster,
    preview,
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!draft) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [draft]);
  const ancestorChild = family.members.find((p) => p.id === ancestorFor);
  useEffect(() => {
    if (ancestorFor && (!ancestorChild || ancestorChild.parents.length >= 2))
      setAncestorFor(null);
  }, [ancestorFor, ancestorChild]);
  const ancestorSlots = ancestorFor
    ? ancestorSlotsFor(
        family,
        scene.positions,
        ancestorFor,
        layout,
        scene.slots,
      )
    : [];
  const menuPerson = menu
    ? family.members.find((person) => person.id === menu.id)
    : undefined;
  const menuItems = personMenuItems({
    menu,
    menuPerson,
    family,
    setMenu,
    ancestorFor,
    onDeath,
    onPartner,
    onChild,
    onBranch,
    onSeparate,
    onDynasty,
    onJoinDynasty,
    onAncestors: (id) => {
      setDraft(null);
      setAncestorFor(ancestorFor === id ? null : id);
      focusPerson(id);
    },
    onEdit,
    onRemove,
  });
  const dynasties = visibleFamily.members.flatMap((person) => {
    if (!person.dynasty) return [];
    const region = dynastyRegion(
      visibleFamily,
      person,
      scene.positions,
      layout,
    );
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
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!draft) setHoveredPort(null);
  }, [draft]);
  const portAt = (x: number, y: number, source: string) =>
    document
      .elementsFromPoint(x, y)
      .map((node) => node.closest<HTMLElement>("[data-link-person]"))
      .find((node) => node && node.dataset.linkPerson !== source);
  const beginLink = (
    event: ReactPointerEvent,
    id: string,
    toward: "parent" | "child",
    pos: Point,
  ) => {
    if (event.button !== 0 || preview || savingMove.current) return;
    event.preventDefault();
    event.stopPropagation();
    const box = personFootprint(pos, layout);
    const from =
      toward === "parent"
        ? { x: box.x + box.w / 2, y: box.y }
        : { x: box.x + box.w / 2, y: box.y + box.h };
    const next = {
      id,
      toward,
      from,
      to: from,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    draftRef.current = next;
    setDraft(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveLink = (event: ReactPointerEvent) => {
    const current = draftRef.current;
    if (!current) return;
    event.stopPropagation();
    const port = portAt(event.clientX, event.clientY, current.id);
    setHoveredPort(
      port ? `${port.dataset.linkPerson}:${port.dataset.linkDirection}` : null,
    );
    const next = {
      ...current,
      to: {
        x: current.from.x + (event.clientX - current.clientX) / view.k,
        y: current.from.y + (event.clientY - current.clientY) / view.k,
      },
    };
    draftRef.current = next;
    setDraft(next);
  };
  const endLink = (event: ReactPointerEvent) => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current) return;
    const port = portAt(event.clientX, event.clientY, current.id);
    const target = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((node) =>
        node instanceof Element ? node.closest("[data-person]") : null,
      )
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          !!node.dataset.person &&
          node.dataset.person !== current.id,
      );
    const targetId = port?.dataset.linkPerson ?? target?.dataset.person;
    if (!targetId) return;
    if (current.toward === "child") onLink(targetId, current.id);
    else onLink(current.id, targetId);
  };
  return (
    <div
      className={`canvas ${layout}${preview ? " preview" : ""}${poster ? " poster" : ""}${draft ? " linking" : ""}${showLinkPorts ? " ports-shown" : ""}`}
      ref={container}
      style={
        poster
          ? { width: poster.tileWidth, height: poster.tileHeight }
          : undefined
      }
      onPointerDown={(e) => {
        if (preview) return;
        if ((e.target as HTMLElement).closest('button,[role="menu"]')) return;
        if (draft) setDraft(null);
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
      {!preview && (
        <div className="canvas-meta">
          <strong>{family.name}</strong>
          <span>{t("memberCount", { count: family.members.length })}</span>
          {focus && (
            <button onClick={() => onFocus(null)}>
              <ArrowUpLeft size={12} /> {t("overview")}
            </button>
          )}
        </div>
      )}
      {!preview && (
        <div className="legend">
          <i /> {t("legendPartnership")} <i className="child" />{" "}
          {t("legendChildren")} <span>╫ {t("legendSeparated")}</span>
        </div>
      )}
      {!preview && layout === "tapestry" && (
        <div className="tapestry-title">
          <span className="wordmark-uri">URI</span>{" "}
          <span className="wordmark-namu">NAMU</span> · {t("ourRoots")}
        </div>
      )}
      {poster && (
        <div
          className={`poster-sheet ${layout}`}
          style={{
            width: poster.sheetWidth,
            height: poster.sheetHeight,
            transform: `translate(${-poster.tileX}px, ${-poster.tileY}px)`,
          }}
        >
          <div className="poster-heading">
            {layout === "tapestry" && (
              <div className="tapestry-title">
                <span className="wordmark-uri">URI</span>{" "}
                <span className="wordmark-namu">NAMU</span> · {t("ourRoots")}
              </div>
            )}
            <strong>{family.name}</strong>
          </div>
        </div>
      )}
      <div
        className="world"
        style={
          poster
            ? {
                left: poster.originX - poster.tileX,
                top: poster.originY - poster.tileY,
                zoom: 1,
              }
            : transformViewport
              ? { left: view.x, top: view.y, transform: `scale(${view.k})` }
              : {
                  left: view.x / view.k,
                  top: view.y / view.k,
                  zoom: view.k,
                }
        }
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
              {region.dynasty.logo && <img src={region.dynasty.logo} alt="" />}
              <span>{region.dynasty.name}</span>
            </div>
          </div>
        ))}
        <TreeConnections
          scene={scene}
          family={family}
          layout={layout}
          poster={poster}
          savingMove={savingMove}
          setMoving={setMoving}
          allPositions={allPositions}
          onMovePair={onMovePair}
          movementBlockers={movementBlockers}
          view={view}
          ancestorSlots={ancestorSlots}
          draft={draft}
          query={query}
        />
        {!poster &&
          !preview &&
          groups.map((group) => {
            const origin = scene.positions[group.personId];
            if (!origin) return null;
            const box = personFootprint(origin, layout);
            const open = openGroups.has(group.personId);
            return (
              <div
                key={group.personId}
                className="partner-accordion"
                style={{ left: box.x, top: box.y + box.h + 6 }}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`partners-${group.personId}`}
                  onClick={() => {
                    if (open && group.foldable.includes(focus ?? ""))
                      onFocus(group.personId);
                    setExpandedPartners((previous) => {
                      const next = new Set(previous);
                      if (open) next.delete(group.personId);
                      else next.add(group.personId);
                      return next;
                    });
                  }}
                >
                  <span aria-hidden="true">{open ? "▾" : "▸"}</span>{" "}
                  {t("morePartners", { count: group.additional.length })}
                </button>
                {open && (
                  <div
                    id={`partners-${group.personId}`}
                    className="partner-accordion-list"
                  >
                    {group.additional.map((union) => {
                      const partner = family.members.find(
                        (p) =>
                          p.id ===
                          (union.a === group.personId ? union.b : union.a),
                      );
                      if (!partner) return null;
                      const status =
                        union.marriage === "divorced"
                          ? t("divorced")
                          : union.status === "separated"
                            ? t("separated")
                            : t("currentPartner");
                      return (
                        <button
                          type="button"
                          key={union.id}
                          onClick={() => onFocus(partner.id)}
                        >
                          <strong>{displayName(partner)}</strong>
                          <span>
                            {status}
                            {union.marriedOn
                              ? ` · ${dateLabel(union.marriedOn)}`
                              : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        {family.members
          .filter((person) => !!scene.positions[person.id])
          .map((p) => {
            const pos = scene.positions[p.id];
            const box = personFootprint(pos, layout);
            const names = nameParts(p);
            return (
              <Fragment key={p.id}>
                <button
                  data-person={p.id}
                  className={`person ${focus === p.id ? "selected" : ""}${
                    matchesQuery(p, query) ? "" : " search-miss"
                  }${guidePersonId === p.id ? " guide-target" : ""}${
                    draft?.id === p.id ? " link-source" : ""
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
                    const target = {
                      x: d.start.x + dx / view.k,
                      y: d.start.y + dy / view.k,
                    };
                    d.point = movementBlockers ? placePerson(p.id, target) : target;
                    setMoving({ [p.id]: d.point });
                  }}
                  onPointerUp={async (e) => {
                    const d = personDrag.current;
                    if (!d || d.id !== p.id) return;
                    e.stopPropagation();
                    personDrag.current = null;
                    if (!d.moved) return;
                    suppressClick.current = p.id;
                    const point = placePerson(p.id, d.point);
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
                  {layout === "chart" ? (
                    <span className="chart-card">
                      <strong>{names.firstName || "..."}</strong>
                      <span className="chart-names">
                        {chartSurnames(p) || "..."}
                      </span>
                      <span>
                        * {p.born ? dateLabel(p.born) : t("dateUnknown")}
                      </span>
                      {(p.died || p.deceased) && (
                        <span>
                          + {p.died ? dateLabel(p.died) : t("deathUnknown")}
                        </span>
                      )}
                    </span>
                  ) : (
                    <>
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
                            <path
                              id={"curve" + p.id}
                              d="M29 37 Q120 64 211 37"
                            />
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
                            fill="#4b3324"
                            fontFamily="Georgia, serif"
                            fontWeight="bold"
                            fontSize={displayName(p).length > 24 ? 10 : 12}
                            style={{ fontVariant: "small-caps" }}
                            textAnchor="middle"
                          >
                            <textPath href={"#curve" + p.id} startOffset="50%">
                              {symbol(p)} {displayName(p)}
                            </textPath>
                          </text>
                          <text
                            x="120"
                            y="62"
                            fill="#4b3324"
                            fontFamily="Georgia, serif"
                            fontStyle="italic"
                            fontWeight="400"
                            textAnchor="middle"
                            fontSize="9"
                          >
                            {years(p)}
                          </text>
                        </svg>
                      )}
                    </>
                  )}
                </button>
                {!poster && (showLinkPorts || !preview) && (
                  <span
                    className="link-ports"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                    }}
                  >
                    {(["parent", "child"] as const).map((toward) => (
                      <span
                        key={toward}
                        role="button"
                        tabIndex={-1}
                        data-link-person={p.id}
                        data-link-direction={toward}
                        className={`link-port ${toward === "parent" ? "up" : "down"}${hoveredPort === `${p.id}:${toward}` ? " is-link-target" : ""}`}
                        aria-label={t(
                          toward === "parent" ? "linkToParent" : "linkToChild",
                        )}
                        title={t(
                          toward === "parent" ? "linkToParent" : "linkToChild",
                        )}
                        onPointerDown={(event) =>
                          beginLink(event, p.id, toward, pos)
                        }
                        onPointerMove={moveLink}
                        onPointerUp={endLink}
                        onPointerCancel={() => {
                          draftRef.current = null;
                          setDraft(null);
                        }}
                      />
                    ))}
                  </span>
                )}
              </Fragment>
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
          scene.slots
            .filter(
              (s) =>
                !family.unions.some(
                  (union) =>
                    union.status === "active" &&
                    (union.a === s.id || union.b === s.id),
                ),
            )
            .map((s) => (
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
              return (
                !!stored && childBranchControl(family, stored) !== "hidden"
              );
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
      {!preview && family.members.length === 0 && (
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
      {query && !family.members.some((p) => matchesQuery(p, query)) && (
        <div className="empty">{t("noneFound")}</div>
      )}
      {!preview && draft && (
        <div className="link-hint" role="status">
          <span>
            {draft.toward === "child"
              ? t("linkDragChild")
              : t("linkDragParent")}
          </span>
          <button
            type="button"
            onClick={() => {
              draftRef.current = null;
              setDraft(null);
            }}
          >
            {t("cancel")}
          </button>
        </div>
      )}
      {!preview && <div className="canvas-hint">{t("canvasHint")}</div>}
      {guide}
      {menu &&
        menuPerson &&
        createPortal(
          <div
            ref={menuRef}
            className={`person-context${guidePersonId === menu.id ? " guide-target" : ""}`}
            role="menu"
            aria-label={t("personActions")}
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 254)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 560)),
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
      {!preview && (
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
          <button data-guide-tidy="" aria-label={t("tidy")} title={t("tidy")} onClick={onTidy}>
            <Shrink size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
