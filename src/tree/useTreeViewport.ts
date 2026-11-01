import { useEffect, useRef, useState } from "react";
import type { Layout, Scene } from "../layout";
import type { PosterFrame } from "../poster";

export function useTreeViewport({
  scene,
  layout,
  focus,
  onFocus,
  poster,
  preview,
}: {
  scene: Scene;
  layout: Layout;
  focus: string | null;
  onFocus: (id: string | null) => void;
  poster: PosterFrame | null;
  preview: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
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
      pad = preview ? 8 : 60,
      head = preview ? 8 : 140,
      k = Math.max(
        0.02,
        Math.min(
          preview ? 1.6 : 1,
          (size.w - pad) / Math.max(b.width, 1),
          (size.h - head) / Math.max(b.height, 1),
        ),
      );
    setView({
      k,
      x: (size.w - b.width * k) / 2 - b.x * k,
      y: (size.h - b.height * k) / 2 - b.y * k + 10,
    });
  };
  useEffect(() => {
    if (poster) return;
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
  }, [layout, size.w, size.h, focus, poster]);
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
      const k = Math.max(0.02, Math.min(2.5, v.k * factor));
      return {
        k,
        x: anchor.x - ((anchor.x - v.x) * k) / v.k,
        y: anchor.y - ((anchor.y - v.y) * k) / v.k,
      };
    });
  useEffect(() => {
    const el = container.current;
    if (!el || poster || preview) return;
    const wheel = (e: WheelEvent) => {
      if (e.target instanceof Element && e.target.closest(".guide-beat"))
        return;
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
  }, [size, poster, preview]);
  return { container, view, setView, fit, focusPerson, zoom };
}
