import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cropRegion } from "./photo";
import { resizePhoto } from "./storage";
import { shown, t } from "./i18n";

export default function PhotoCrop({
  file,
  onApply,
  onCancel,
}: {
  file: File;
  onApply: (photo: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const alive = useRef(true);
  const [url, setUrl] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [previewSize, setPreviewSize] = useState(280);
  const [selection, setSelection] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const observer = new ResizeObserver((entries) =>
      setPreviewSize(entries[0].contentRect.width),
    );
    if (preview.current) observer.observe(preview.current);
    return () => {
      alive.current = false;
      observer.disconnect();
      element?.close();
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (busy || !dimensions.width) return;
      drag.current = null;
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1);
      setSelection((v) => ({
        ...v,
        zoom: Math.max(
          0.1,
          Math.min(
            8,
            v.zoom * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.0015),
          ),
        ),
      }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [busy, dimensions.width]);
  const crop = cropRegion(
    dimensions.width,
    dimensions.height,
    selection.zoom,
    selection.x,
    selection.y,
  );
  const ratio =
    dimensions.width && crop.width ? previewSize / crop.width : 1;
  return createPortal(
    <dialog
      ref={dialog}
      className="modal crop-modal"
      aria-label={t("cropLabel")}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <header>
        <h2>{t("cropTitle")}</h2>
        <button
          type="button"
          aria-label={t("closeCrop")}
          disabled={busy}
          onClick={onCancel}
        >
          ×
        </button>
      </header>
      <p>
        {t("cropHelp")}
      </p>
      <div
        className="crop-preview"
        ref={preview}
        onPointerDown={(e) => {
          if (!dimensions.width || busy) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            startX: selection.x,
            startY: selection.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const scale =
            (preview.current?.clientWidth || 280) / Math.max(crop.width, 1);
          setSelection((v) => ({
            ...v,
            x: d.startX - (e.clientX - d.x) / (dimensions.width * scale),
            y: d.startY - (e.clientY - d.y) / (dimensions.height * scale),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="crop-image-space">
          <img
            src={url}
            alt={t("cropAlt")}
            draggable={false}
            style={{
              width: dimensions.width * ratio || 320,
              height: dimensions.height * ratio || 320,
              left: -crop.x * ratio,
              top: -crop.y * ratio,
            }}
            onLoad={(e) =>
              setDimensions({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            onError={() => {
              if (url) setError(t("imageOpenFailed"));
            }}
          />
        </div>
        <div className="crop-guide" />
      </div>
      <label>
        {t("zoomAmount", { percent: Math.round(selection.zoom * 100) })}
        <input
          aria-label={t("zoomCrop")}
          type="range"
          min="0.1"
          max="8"
          step="0.01"
          value={selection.zoom}
          disabled={busy}
          onChange={(e) =>
            setSelection((v) => ({ ...v, zoom: +e.target.value }))
          }
        />
      </label>
      <label>
        {t("horizontalCrop")}
        <input
          type="range"
          min={Math.min(-1, Math.floor(selection.x))}
          max={Math.max(2, Math.ceil(selection.x))}
          step="0.01"
          value={selection.x}
          disabled={busy}
          onChange={(e) => setSelection((v) => ({ ...v, x: +e.target.value }))}
        />
      </label>
      <label>
        {t("verticalCrop")}
        <input
          type="range"
          min={Math.min(-1, Math.floor(selection.y))}
          max={Math.max(2, Math.ceil(selection.y))}
          step="0.01"
          value={selection.y}
          disabled={busy}
          onChange={(e) => setSelection((v) => ({ ...v, y: +e.target.value }))}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {shown(error)}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            drag.current = null;
            setSelection({ zoom: 1, x: 0.5, y: 0.5 });
          }}
        >
          {t("reset")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !dimensions.width || !!error}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const photo = await resizePhoto(file, selection);
              if (alive.current) onApply(photo);
            } catch (e) {
              if (alive.current) setError(String(e));
            } finally {
              if (alive.current) setBusy(false);
            }
          }}
        >
          {busy ? t("photoBusy") : t("applyCrop")}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
