import { describe, it, expect } from "vitest";
import { cropRegion, cropSample, portraitRatio } from "../src/photo";
import { dateLabel, dateValue } from "../src/dates";
import { connectionPort, branchMarkerPosition } from "../src/layout";

describe("Portrait crop", () => {
  it("uses the selected portrait frame rather than always cropping the center", () => {
    const wide = cropRegion(1200, 800, 1, 0.5, 0.5);
    expect(wide).toMatchObject({ y: 0, height: 800 });
    expect(wide.width / wide.height).toBeCloseTo(portraitRatio);
    expect(wide.x).toBeCloseTo(600 - wide.width / 2);
    const shifted = cropRegion(1200, 800, 2, 0.75, 0.5);
    expect(shifted).toMatchObject({ y: 200, height: 400 });
    expect(shifted.x).toBeCloseTo(900 - shifted.width / 2);
    const tall = cropRegion(800, 1200, 1, 0.5, 0.5);
    expect(tall).toMatchObject({ y: 200, height: 800 });
    expect(tall.x).toBeCloseTo(400 - tall.width / 2);
  });
  it("keeps a zoomed-out, shifted picture inside the dashed frame instead of stretching it", () => {
    const crop = cropRegion(800, 800, 0.5, 0.5, 0.5);
    expect(crop.width).toBeGreaterThan(800);
    expect(crop.height).toBe(1600);
    const sample = cropSample(800, 800, crop, 600, 700);
    expect(sample).not.toBeNull();
    expect(sample!.sw).toBe(800);
    expect(sample!.dw).toBeCloseTo(600 * (800 / crop.width));
    expect(sample!.dw).toBeLessThan(600);
    expect(sample!.dx).toBeGreaterThan(0);
    expect(sample!.dy).toBeGreaterThan(0);
    const shifted = cropRegion(800, 800, 1, -0.5, 1.5);
    expect(shifted.x).toBeLessThan(0);
    expect(shifted.y).toBeGreaterThanOrEqual(800);
    expect(cropSample(800, 800, shifted, 300, 350)).toBeNull();
    const inside = cropSample(
      800,
      800,
      cropRegion(800, 800, 2, 0.5, 0.5),
      300,
      350,
    );
    expect(inside!.dx).toBeCloseTo(0);
    expect(inside!.dy).toBeCloseTo(0);
    expect(inside!.dw).toBeCloseTo(300);
    expect(inside!.dh).toBeCloseTo(350);
  });
});
describe("Date examples", () => {
  it("keeps empty values empty and converts typed calendar dates to ISO", () => {
    expect(dateValue("")).toBe("");
    expect(dateLabel("")).toBe("");
    expect(dateValue("14.03.1985")).toBe("1985-03-14");
    expect(dateLabel("1985-03-14")).toBe("14.03.1985");
    expect(dateValue("14.03.")).toBe("14.03.");
  });
});
describe("Card ports", () => {
  it("anchors connections to solid card boundaries", () => {
    expect(
      connectionPort({ x: 0, y: 0 }, { x: 400, y: 60 }, "classic"),
    ).toEqual({ x: 180, y: 60 });
    expect(
      connectionPort({ x: 0, y: 0 }, { x: 90, y: 300 }, "classic"),
    ).toEqual({ x: 90, y: 120 });
    expect(
      connectionPort({ x: 0, y: 0 }, { x: 400, y: 63 }, "tapestry"),
    ).toEqual({ x: 197, y: 63 });
    expect(
      connectionPort({ x: 0, y: 0 }, { x: 90, y: 300 }, "tapestry"),
    ).toEqual({ x: 90, y: 126 });
  });
});

it("centers childless labels along either branch orientation without fixed text-width offsets", () => {
  expect(
    branchMarkerPosition({ x: 100, y: 60 }, { x: 100, y: 164 }, true),
  ).toEqual({ x: 100, y: 112 });
  expect(
    branchMarkerPosition({ x: 100, y: 60 }, { x: 235, y: 60 }, true),
  ).toEqual({ x: 167.5, y: 60 });
  expect(
    branchMarkerPosition({ x: 100, y: 60 }, { x: 235, y: 60 }, false),
  ).toEqual({ x: 235, y: 60 });
});
