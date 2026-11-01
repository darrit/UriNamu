export type Layout = "classic" | "horizontal" | "tapestry" | "chart";

export const layoutModes = [
  "classic",
  "horizontal",
  "tapestry",
  "chart",
] as const;

export type Point = { x: number; y: number };

export type Blocker = { at: Point; separation: Point };

export type Rect = { x: number; y: number; w: number; h: number };

export interface Scene {
  positions: Record<string, Point>;
  slots: { id: string; x: number; y: number }[];
  unions: {
    id: string;
    a: Point;
    b: Point;
    joint: Point;
    branch: Point;
    marker: Point;
    children: Point[];
    childPaths?: string[];
    separated: boolean;
    ended: boolean;
    partnerPath?: string;
    tangentAngle?: number;
  }[];
  singles: { a: Point; b: Point }[];
  bounds: { x: number; y: number; width: number; height: number };
}
