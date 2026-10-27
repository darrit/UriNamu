import { useEffect, useRef, useState } from "react";
import Tree from "./Tree";
import { type Family } from "./domain";
import { type Layout } from "./layout";
import {
  measureSheet,
  posterTiles,
  type PosterFrame,
  type PosterPage,
  type PosterTile,
} from "./poster";

const idle = () => {};
const refuse = async () => false;

async function paintTile(
  node: HTMLElement,
  tile: PosterTile,
  pixelRatio: number,
) {
  const { toCanvas } = await import("html-to-image");
  const canvas = await toCanvas(node, {
    pixelRatio,
    cacheBust: true,
    skipAutoScale: true,
    backgroundColor: "#111915",
    width: tile.tileWidth,
    height: tile.tileHeight,
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value);
        else reject(Error("jpeg"));
      },
      "image/jpeg",
      0.82,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function PdfJob({
  family,
  layout,
  onProgress,
  onDone,
  onError,
}: {
  family: Family;
  layout: Layout;
  onProgress: (done: number, total: number) => void;
  onDone: (bytes: Uint8Array) => void;
  onError: (error: unknown) => void;
}) {
  const plan = useRef(posterTiles(measureSheet(family, layout)));
  const [frame, setFrame] = useState<PosterFrame | null>(null);
  const painted = useRef<(node: HTMLElement) => void>(() => {});
  const host = useRef<HTMLDivElement>(null);
  const progress = useRef(onProgress);
  const done = useRef(onDone);
  const fail = useRef(onError);
  progress.current = onProgress;
  done.current = onDone;
  fail.current = onError;

  useEffect(() => {
    const { pages, tiles, pixelRatio } = plan.current;
    let cancel = false;
    const waitPaint = () =>
      new Promise<HTMLElement>((resolve) => {
        painted.current = resolve;
      });
    void (async () => {
      try {
        const bytes = await buildPdf(pages, tiles, pixelRatio, waitPaint, () =>
          cancel,
        (index, total) => progress.current(index, total), setFrame);
        if (!cancel) done.current(bytes);
      } catch (error) {
        if (!cancel) fail.current(error);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [family, layout]);

  useEffect(() => {
    if (!frame || !host.current) return;
    const root = host.current.querySelector(".canvas");
    if (!(root instanceof HTMLElement)) return;
    let cancel = false;
    const imgs = [...root.querySelectorAll("img")];
    void Promise.all(
      imgs.map((img) =>
        img.decode().catch(() => undefined),
      ),
    ).then(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!cancel) painted.current(root);
    });
    return () => {
      cancel = true;
    };
  }, [frame]);

  return (
    <div className="poster-host" ref={host} aria-hidden="true">
      {frame && (
        <Tree
          poster={frame}
          preview
          family={family}
          layout={layout}
          query=""
          focus={null}
          showPartnerSlots={false}
          onFocus={idle}
          onMove={refuse}
          onMovePair={refuse}
          onTidy={idle}
          onEdit={idle}
          onPartner={idle}
          onBranch={idle}
          onAncestor={idle}
          onChild={idle}
          onSeparate={idle}
          onDeath={idle}
          onDynasty={idle}
          onJoinDynasty={idle}
          onRemove={idle}
        />
      )}
    </div>
  );
}

async function buildPdf(
  pages: PosterPage[],
  tiles: PosterTile[],
  pixelRatio: number,
  waitPaint: () => Promise<HTMLElement>,
  cancelled: () => boolean,
  onProgress: (done: number, total: number) => void,
  setFrame: (frame: PosterFrame) => void,
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const label = pages.length > 1 ? 16 : 0;
  const pdfPages = pages.map((page) =>
    pdf.addPage([page.ptWidth, page.ptHeight + label]),
  );
  for (let index = 0; index < tiles.length; index += 1) {
    if (cancelled()) throw Error("cancelled");
    onProgress(index + 1, tiles.length);
    const tile = tiles[index];
    setFrame(tile);
    const node = await waitPaint();
    if (cancelled()) throw Error("cancelled");
    const jpeg = await paintTile(node, tile, pixelRatio);
    const image = await pdf.embedJpg(jpeg);
    const page = pages[tile.page];
    const scaleX = page.ptWidth / page.width;
    const scaleY = page.ptHeight / page.height;
    pdfPages[tile.page].drawImage(image, {
      x: tile.xOnPage * scaleX,
      y: label + page.ptHeight - (tile.yOnPage + tile.tileHeight) * scaleY,
      width: tile.tileWidth * scaleX,
      height: tile.tileHeight * scaleY,
    });
  }
  if (label) {
    pdfPages.forEach((pdfPage, index) => {
      pdfPage.drawText(`UriNamu  ${index + 1}/${pages.length}`, {
        x: 8,
        y: 4,
        size: 9,
        font,
        color: rgb(0.2, 0.24, 0.2),
      });
    });
  }
  return pdf.save();
}
