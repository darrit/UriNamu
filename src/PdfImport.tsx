import { useEffect, useRef, useState } from "react";
import { FileImage, X } from "lucide-react";
import { displayName, normalize, years, type Family, type Person } from "./domain";
import { t } from "./i18n";
import { familyNameFromFile } from "./pdfText";
import { PDF_BYTE_LIMIT, PdfReadError, readPdf, type PdfReading } from "./pdfRead";

export function PdfImport({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (family: Family) => Promise<boolean>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<PdfReading | null>(null);
  const [source, setSource] = useState<"embedded" | "generic">("embedded");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const selected = source === "embedded" ? reading?.embedded : reading?.generic;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, []);
  const openFile = async (file: File) => {
    if (file.size > PDF_BYTE_LIMIT) {
      setError(t("pdfTooBig"));
      return;
    }
    setBusy(true);
    setError("");
    setReading(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await readPdf(
        bytes,
        familyNameFromFile(file.name) || t("pdfDefaultName"),
      );
      if (!result.embedded && !result.generic) {
        setError(
          result.embeddedBroken
            ? t("pdfEmbeddedBroken")
            : result.hasText
              ? t("pdfGenericEmpty")
              : t("pdfNoText"),
        );
        return;
      }
      const nextSource = result.embedded ? "embedded" : "generic";
      setSource(nextSource);
      setName((nextSource === "embedded" ? result.embedded : result.generic)?.name ?? "");
      setReading(result);
    } catch (caught) {
      if (caught instanceof PdfReadError)
        setError(
          t(
            caught.code === "encrypted"
              ? "pdfEncrypted"
              : caught.code === "too-big"
                ? "pdfTooBig"
                : "pdfInvalid",
          ),
        );
      else setError(t("pdfInvalid"));
    } finally {
      setBusy(false);
    }
  };
  const choose = (next: "embedded" | "generic") => {
    setSource(next);
    setName((next === "embedded" ? reading?.embedded : reading?.generic)?.name ?? name);
    setError("");
  };
  return (
    <dialog
      className="modal"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2>{t("pdfReadTitle")}</h2>
        <button type="button" className="icon" aria-label={t("close")} onClick={onClose} disabled={busy}>
          <X size={19} />
        </button>
      </header>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!selected || busy) return;
          const trimmed = name.trim();
          if (!trimmed || trimmed.length > 100) return;
          setBusy(true);
          setError("");
          try {
            const next = structuredClone(selected);
            next.name = trimmed;
            if (await onCreate(normalize(next))) onClose();
            else setError(t("pdfInvalid"));
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : typeof caught === "string" ? caught : t("pdfInvalid"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{t("pdfReadBody")}</p>
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void openFile(file);
          }}
        />
        {!reading && (
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <FileImage size={16} /> {busy ? t("pdfReading") : t("pdfChoose")}
            </button>
          </div>
        )}
        {reading && selected && (
          <>
            <p>
              {source === "embedded"
                ? t("pdfEmbeddedNote")
                : reading.embeddedBroken
                  ? t("pdfEmbeddedBroken")
                  : reading.layout === "chart"
                    ? t("pdfChartNote")
                    : t("pdfGenericNote")}
            </p>
            <p className="hint">{t("pdfNoPhotos")}</p>
            {(reading.truncated || reading.partial) && (
              <p className="hint">
                {reading.truncated ? t("pdfTruncated") : ""}
                {reading.truncated && reading.partial ? " " : ""}
                {reading.partial ? t("pdfPartial") : ""}
              </p>
            )}
            <div className="fields">
              <label>
                {t("treeName")}
                <input
                  value={name}
                  maxLength={100}
                  required
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            </div>
            <p className="hint">{t("pdfPeopleCount", { count: selected.members.length })}</p>
            <div className="pdf-people">
              {selected.members.map((person) => (
                <div key={person.id}>
                  <strong>{displayName(person)}</strong>
                  <small>
                    {[years(person), relation(selected, person)].filter(Boolean).join(" · ")}
                  </small>
                </div>
              ))}
            </div>
          </>
        )}
        {reading && !selected && (
          <p>{reading.hasText ? t("pdfGenericEmpty") : t("pdfNoText")}</p>
        )}
        {error && (
          <p ref={errorRef} className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          {reading?.embedded && source !== "embedded" && (
            <button type="button" disabled={busy} onClick={() => choose("embedded")}>
              {t("pdfUseEmbedded")}
            </button>
          )}
          {reading?.embedded && source === "embedded" && (
            <button type="button" disabled={busy} onClick={() => choose("generic")}>
              {t("pdfReadText")}
            </button>
          )}
          {selected && (
            <button className="primary" disabled={busy || !name.trim()}>
              {t("pdfCreateTree")}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function relation(family: Family, person: Person) {
  const bits: string[] = [];
  if (person.parents.length === 2) {
    const names = person.parents.map(
      (id) => family.members.find((item) => item.id === id)?.name ?? "",
    );
    if (names.every(Boolean)) bits.push(t("pdfChildOf", { names: names.join(", ") }));
  }
  const union = family.unions.find(
    (item) => item.status === "active" && (item.a === person.id || item.b === person.id),
  );
  if (union) {
    const other = family.members.find(
      (item) => item.id === (union.a === person.id ? union.b : union.a),
    );
    if (other) bits.push(t("pdfPartnerOf", { name: other.name }));
  }
  return bits.join(" · ");
}
