import { useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GuideBeat } from "./guide";

function targetRegion(target: Element) {
  const canvas = target.closest(".canvas");
  const clip = canvas?.getBoundingClientRect();
  const parts = target.matches(".tapestry .person")
    ? Array.from(target.querySelectorAll(".portrait, .ribbon"))
    : [target];
  const bounds = parts.map((part) => part.getBoundingClientRect());
  const padding = 5;
  const x = Math.max(
    0,
    clip?.left ?? 0,
    Math.min(...bounds.map((r) => r.left)) - padding,
  );
  const y = Math.max(
    0,
    clip?.top ?? 0,
    Math.min(...bounds.map((r) => r.top)) - padding,
  );
  const right = Math.min(
    window.innerWidth,
    clip?.right ?? Infinity,
    Math.max(...bounds.map((r) => r.right)) + padding,
  );
  const bottom = Math.min(
    window.innerHeight,
    clip?.bottom ?? Infinity,
    Math.max(...bounds.map((r) => r.bottom)) + padding,
  );
  return { x, y, width: right - x, height: bottom - y };
}

type Region = ReturnType<typeof targetRegion>;

function dockCard(card: HTMLElement, canvas: DOMRect, target: Region) {
  const left = target.x - canvas.left;
  const right = canvas.right - target.x - target.width;
  const top = target.y - canvas.top;
  const bottom = canvas.bottom - target.y - target.height;
  const width = Math.max(left, right) - 24;
  const horizontal = width >= 200;
  const side = horizontal
    ? left >= right ? "left" : "right"
    : top >= bottom ? "top" : "bottom";
  const space = horizontal ? width : Math.max(top, bottom) - 16;
  const size = `${Math.max(0, Math.floor(space))}px`;
  if (card.dataset.guideDock !== side) card.dataset.guideDock = side;
  if (card.style.getPropertyValue("--guide-space") !== size)
    card.style.setProperty("--guide-space", size);
}

export function GuideSpotlight({ beat }: { beat: GuideBeat }) {
  const maskId = useId();
  const [regions, setRegions] = useState<Region[]>([]);

  useLayoutEffect(() => {
    const main = document.querySelector(".shell > main");
    if (!main) return;
    const header = main.querySelector(".page-head");
    const canvas = main.querySelector(":scope > .canvas");
    const personBeat = beat === "person" || beat === "menu";
    const card = canvas?.querySelector<HTMLElement>(":scope > .guide-beat");
    const resetDock = () => {
      if (card?.dataset.guideDock) {
        delete card.dataset.guideDock;
        card.style.removeProperty("--guide-space");
      }
    };
    let frame = 0;
    const measure = () => {
      const expand = header?.querySelector(".head-toggle");
      const targets =
        beat === "empty"
          ? [header?.querySelector("#add-member") ?? expand]
          : beat === "layouts"
            ? [
                header?.querySelector(".tabs") ?? expand,
                canvas?.querySelector("[data-guide-tidy]"),
              ]
            : [canvas?.querySelector(".world .person.guide-target")];
      const visibleRegions = targets.flatMap((target) => {
        if (!target) return [];
        const region = targetRegion(target);
        return region.width > 0 && region.height > 0 ? [region] : [];
      });
      setRegions(visibleRegions);
      if (personBeat && card && canvas && visibleRegions[0])
        dockCard(card, canvas.getBoundingClientRect(), visibleRegions[0]);
      else resetDock();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const resize = new ResizeObserver(schedule);
    resize.observe(main);
    if (header) resize.observe(header);
    if (canvas) resize.observe(canvas);
    const mutations = new MutationObserver(schedule);
    mutations.observe(main, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      resetDock();
    };
  }, [beat]);

  return createPortal(
    <svg className="guide-spotlight" aria-hidden="true">
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="100%"
        height="100%"
      >
        <rect width="100%" height="100%" fill="white" />
        {regions.map((region, index) => (
          <rect key={index} {...region} rx="8" fill="black" />
        ))}
      </mask>
      <rect
        className="guide-shade"
        width="100%"
        height="100%"
        mask={`url(#${maskId})`}
      />
      {regions.map((region, index) => (
        <rect className="guide-frame" key={index} {...region} rx="8" />
      ))}
    </svg>,
    document.body,
  );
}
