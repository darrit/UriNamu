import { type Family } from "./domain";
import {
  dynastyRegion,
  layoutFamily,
  preserveLayout,
  type Layout,
} from "./layout";

/** Screen pixels per CSS pixel. Two keeps the picture sharp without a huge file. */
export const PIXEL_RATIO = 2;
/** The page is the on-screen sheet, in PDF points. */
export const PT_PER_CSS = 72 / 96;
/** Acrobat still opens a page up to 200 inches. Stay under that. */
const MAX_PAGE_PT = 14000;
/** One tile stays inside the browser canvas limit. A whole sheet uses the larger limit. */
const MAX_CANVAS_PX = 16384;
const MAX_TILE_PX = 8192;
export const POSTER_PAD = 96;

export type Sheet = { x: number; y: number; width: number; height: number };

export function measureSheet(family: Family, layout: Layout): Sheet {
  const scene = layoutFamily(preserveLayout(null, family), layout, null, {}, {
    partnerSlots: false,
  });
  let minX = scene.bounds.x,
    minY = scene.bounds.y,
    maxX = scene.bounds.x + scene.bounds.width,
    maxY = scene.bounds.y + scene.bounds.height;
  for (const person of family.members) {
    if (!person.dynasty) continue;
    const region = dynastyRegion(family, person, scene.positions, layout);
    if (!region) continue;
    minX = Math.min(minX, region.rect.x);
    minY = Math.min(minY, region.rect.y);
    maxX = Math.max(maxX, region.rect.x + region.rect.w);
    maxY = Math.max(maxY, region.rect.y + region.rect.h);
  }
  return {
    x: minX - POSTER_PAD,
    y: minY - POSTER_PAD,
    width: Math.max(1, maxX - minX + POSTER_PAD * 2),
    height: Math.max(1, maxY - minY + POSTER_PAD * 2),
  };
}

export type PosterFrame = {
  sheetWidth: number;
  sheetHeight: number;
  tileX: number;
  tileY: number;
  tileWidth: number;
  tileHeight: number;
  originX: number;
  originY: number;
};

export type PosterPage = {
  x: number;
  y: number;
  width: number;
  height: number;
  ptWidth: number;
  ptHeight: number;
};

export type PosterTile = PosterFrame & {
  page: number;
  xOnPage: number;
  yOnPage: number;
};

export function posterTiles(sheet: Sheet): {
  pages: PosterPage[];
  tiles: PosterTile[];
  pixelRatio: number;
} {
  const maxCss = Math.max(1, Math.floor(MAX_PAGE_PT / PT_PER_CSS));
  const fitsOneCanvas =
    Math.ceil(sheet.width * PIXEL_RATIO) <= MAX_CANVAS_PX &&
    Math.ceil(sheet.height * PIXEL_RATIO) <= MAX_CANVAS_PX;
  const captureCss = fitsOneCanvas
    ? Math.max(sheet.width, sheet.height)
    : Math.max(1, Math.floor(MAX_TILE_PX / PIXEL_RATIO));
  const pages: PosterPage[] = [];
  for (let y = 0; y < sheet.height; y += maxCss)
    for (let x = 0; x < sheet.width; x += maxCss) {
      const width = Math.min(maxCss, sheet.width - x);
      const height = Math.min(maxCss, sheet.height - y);
      pages.push({
        x,
        y,
        width,
        height,
        ptWidth: width * PT_PER_CSS,
        ptHeight: height * PT_PER_CSS,
      });
    }
  const tiles: PosterTile[] = [];
  pages.forEach((page, pageIndex) => {
    for (let y = page.y; y < page.y + page.height; y += captureCss)
      for (let x = page.x; x < page.x + page.width; x += captureCss) {
        const tileWidth = Math.min(captureCss, page.x + page.width - x);
        const tileHeight = Math.min(captureCss, page.y + page.height - y);
        tiles.push({
          sheetWidth: sheet.width,
          sheetHeight: sheet.height,
          tileX: x,
          tileY: y,
          tileWidth,
          tileHeight,
          originX: -sheet.x,
          originY: -sheet.y,
          page: pageIndex,
          xOnPage: x - page.x,
          yOnPage: y - page.y,
        });
      }
  });
  return { pages, tiles, pixelRatio: PIXEL_RATIO };
}
