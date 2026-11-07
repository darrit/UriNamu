import { useRef, type RefObject } from "react";
import { type Family, matchesQuery } from "../domain";
import {
  flowingConnector,
  freePair,
  blockersAround,
  type Layout,
  type Point,
  type Scene,
  type ancestorSlotsFor,
} from "../layout";
import type { PosterFrame } from "../poster";
import { dateLabel } from "../dates";
import { t } from "../i18n";
import { SeparationMark } from "./SeparationMark";
import { weddingAnchor } from "./weddingAnchor";

export function TreeConnections({
  scene,
  family,
  layout,
  poster,
  savingMove,
  setMoving,
  allPositions,
  onMovePair,
  movementBlockers,
  view,
  ancestorSlots,
  draft,
  query,
}: {
  scene: Scene;
  family: Family;
  layout: Layout;
  poster: PosterFrame | null;
  savingMove: RefObject<boolean>;
  setMoving: (points: Record<string, Point>) => void;
  allPositions: Record<string, Point>;
  onMovePair: (
    ids: [string, string],
    points: Record<string, Point>,
  ) => Promise<boolean>;
  movementBlockers?: typeof blockersAround;
  view: { k: number };
  ancestorSlots: ReturnType<typeof ancestorSlotsFor>;
  draft: { from: Point; to: Point } | null;
  query: string;
}) {
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
  const blockers = movementBlockers ?? blockersAround;
  const placeCouple = ({
    a,
    b,
    pointA,
    pointB,
  }: {
    a: string;
    b: string;
    pointA: Point;
    pointB: Point;
  }) =>
    freePair(
      pointA,
      pointB,
      blockers(family, allPositions, a, layout, [b]),
      layout,
      blockers(family, allPositions, b, layout, [a]),
    );
  const ink =
    layout === "tapestry"
      ? { partner: "#baa474", child: "#dcd0ae", separated: "#a5968a", width: 2 }
      : {
          partner: "#b49183",
          child: "#8ca79a",
          separated: "#9d8992",
          width: 1.7,
        };
  const curve = (a: Point, b: Point) => flowingConnector(a, b);
  return (
    <>
      <svg
        className="edges"
        width="1"
        height="1"
        fill="none"
        overflow="visible"
        aria-hidden="true"
      >
        {scene.unions.map((u) => (
          <g key={u.id} data-relationship={u.id}>
            <path
              className={u.separated ? "separated" : "partnership"}
              d={u.partnerPath || curve(u.a, u.b)}
              fill="none"
              stroke={u.separated ? ink.separated : ink.partner}
              strokeWidth={ink.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {!poster && (
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
                  if (movementBlockers) {
                    const placed = placeCouple(d);
                    d.pointA = placed.a;
                    d.pointB = placed.b;
                  }
                  setMoving({ [d.a]: d.pointA, [d.b]: d.pointB });
                }}
                onPointerUp={async (e) => {
                  const d = coupleDrag.current;
                  const stored = family.unions.find((item) => item.id === u.id);
                  if (!d || !stored || d.a !== stored.a) return;
                  e.stopPropagation();
                  coupleDrag.current = null;
                  if (!d.moved) return;
                  const placed = placeCouple(d);
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
            )}
            {u.separated && (
              <SeparationMark
                path={u.partnerPath || curve(u.a, u.b)}
                fallback={u.joint}
                angle={u.tangentAngle ?? 0}
              />
            )}
            {u.children.map((p, i) => (
              <path
                key={i}
                className="child"
                d={u.childPaths?.[i] || curve(u.joint, p)}
                fill="none"
                stroke={ink.child}
                strokeWidth={ink.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}
        {ancestorSlots.map((s) => (
          <path
            key={"ancestor" + s.personId + s.index}
            className="ancestor-edge"
            fill="none"
            stroke="#a9a37c"
            strokeWidth={ink.width}
            strokeLinecap="round"
            strokeDasharray="4 6"
            opacity="0.6"
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
          <path
            key={"s" + i}
            className="child"
            d={curve(s.a, s.b)}
            fill="none"
            stroke={ink.child}
            strokeWidth={ink.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {draft && (
          <path
            className="link-draft"
            d={`M${draft.from.x},${draft.from.y}L${draft.to.x},${draft.to.y}`}
            fill="none"
            stroke="#cbb98a"
            strokeWidth="1.6"
            strokeDasharray="5 4"
          />
        )}
      </svg>
      {scene.unions.map((drawn) => {
        const stored = family.unions.find((item) => item.id === drawn.id);
        if (!stored) return null;
        const married =
          stored.marriage === "married" || stored.marriage === "divorced";
        if (
          !married &&
          (layout === "tapestry" || stored.status === "separated")
        )
          return null;
        const originA = scene.positions[stored.a];
        const originB = scene.positions[stored.b];
        if (!originA || !originB) return null;
        const divorced = stored.marriage === "divorced";
        const radians = ((drawn.tangentAngle ?? 0) * Math.PI) / 180;
        const labelJoint = divorced
          ? {
              x: drawn.joint.x + Math.sin(radians) * 26,
              y: drawn.joint.y - Math.cos(radians) * 26,
            }
          : drawn.joint;
        const at = weddingAnchor(
          originA,
          originB,
          labelJoint,
          drawn.children,
          drawn.a,
          drawn.b,
          layout,
        );
        const faded =
          !!query &&
          [stored.a, stored.b].every((id) => {
            const person = family.members.find((item) => item.id === id);
            return !person || !matchesQuery(person, query);
          });
        const former = !married && stored.status === "separated";
        const wedding = stored.marriedOn
          ? dateLabel(stored.marriedOn)
          : t("dateUnknown");
        const mark = married
          ? `${layout === "chart" ? "oo " : ""}${wedding}`
          : former
            ? "="
            : "–";
        return (
          <span
            key={stored.id}
            className={`wedding-date${divorced ? " is-divorced" : ""}${faded ? " search-miss" : ""}${!married ? " is-minus" : ""}`}
            style={{ left: at.x, top: at.y }}
            title={
              divorced
                ? `${t("divorced")} · ${t("weddingDate")}`
                : married
                  ? t("weddingDate")
                  : former
                    ? t("formerUnmarried")
                    : t("currentUnmarried")
            }
          >
            {mark}
          </span>
        );
      })}
    </>
  );
}
