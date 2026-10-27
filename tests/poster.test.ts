import { describe, expect, it } from "vitest";
import {
  PIXEL_RATIO,
  PT_PER_CSS,
  posterTiles,
  type Sheet,
} from "../src/poster";

function covered(sheet: Sheet) {
  const { pages, tiles } = posterTiles(sheet);
  let area = 0;
  for (const tile of tiles) {
    expect(tile.tileX + tile.tileWidth).toBeLessThanOrEqual(sheet.width);
    expect(tile.tileY + tile.tileHeight).toBeLessThanOrEqual(sheet.height);
    expect(Math.round(tile.tileWidth * PIXEL_RATIO)).toBeLessThanOrEqual(8192);
    area += tile.tileWidth * tile.tileHeight;
  }
  return { pages, tiles, area };
}

describe("poster tiles", () => {
  it("prints the sheet at screen size and twice the pixels", () => {
    expect(PIXEL_RATIO).toBe(2);
    expect(PT_PER_CSS).toBeCloseTo(0.75);
  });

  it("keeps one modest sheet on a single page", () => {
    const { pages, tiles } = posterTiles({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].ptWidth).toBeCloseTo(900);
    expect(pages[0].ptHeight).toBeCloseTo(600);
    for (const tile of tiles) {
      expect(Math.round(tile.tileWidth * PIXEL_RATIO)).toBeLessThanOrEqual(16384);
      expect(Math.round(tile.tileHeight * PIXEL_RATIO)).toBeLessThanOrEqual(16384);
    }
    expect(tiles).toHaveLength(1);
  });

  it("splits a sheet that would exceed 200 inches and covers every pixel", () => {
    const sheet = { x: -40, y: 10, width: 20000, height: 900 };
    const { pages, tiles, area } = covered(sheet);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.ptWidth).toBeLessThanOrEqual(14000);
      expect(page.ptHeight).toBeLessThanOrEqual(14000);
    }
    expect(area).toBe(sheet.width * sheet.height);
    expect(tiles.length).toBeGreaterThan(pages.length);
  });
});
