import { useRef, useState, useLayoutEffect } from "react";
import type { Point } from "../layout";

export function SeparationMark({
  path,
  fallback,
  angle,
}: {
  path: string;
  fallback: Point;
  angle: number;
}) {
  const ref = useRef<SVGPathElement>(null);
  const [at, setAt] = useState({ ...fallback, angle });
  useLayoutEffect(() => {
    const line = ref.current;
    if (!line) return;
    const length = line.getTotalLength();
    const mid = line.getPointAtLength(length / 2);
    const a = line.getPointAtLength(Math.max(0, length / 2 - 0.5));
    const b = line.getPointAtLength(Math.min(length, length / 2 + 0.5));
    setAt({
      x: mid.x,
      y: mid.y,
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    });
  }, [path]);
  return (
    <g pointerEvents="none">
      <path ref={ref} d={path} visibility="hidden" />
      <g transform={`translate(${at.x}, ${at.y}) rotate(${at.angle})`}>
        <path
          className="strike"
          d="M-9 -9l9 18M0 -9l9 18"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}
