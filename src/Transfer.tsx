import { useState } from "react";
import { Modal } from "./Modal";
import { t, shown } from "./i18n";
import { Download, FileImage, Upload, LockKeyhole } from "lucide-react";
import { type Family } from "./domain";
import { desktop, exportFamily, importFamily } from "./storage";
import { lines } from "./lines";

export default function Transfer({
  mode,
  family,
  ask,
  onClose,
  onImport,
  onNotice,
  onPdf,
  onPdfImport,
}: {
  mode: "export" | "import";
  family: Family;
  ask: (s: string) => Promise<boolean>;
  onClose: () => void;
  onImport: (f: Family) => Promise<boolean>;
  onNotice: (s: string) => void;
  onPdf: (includeData: boolean) => void;
  onPdfImport: () => void;
}) {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [includeData, setIncludeData] = useState(true),
    [kind, setKind] = useState<"choose" | "file">("choose");
  if (kind === "choose" && mode === "import")
    return (
      <Modal title={t("importChooseTitle")} onClose={onClose}>
        <p>{t("importChooseBody")}</p>
        <div className="actions export-choices">
          <button
            type="button"
            className="primary"
            onClick={() => {
              onPdfImport();
              onClose();
            }}
          >
            <FileImage size={16} /> {t("importAsPdf")}
          </button>
          <button type="button" onClick={() => setKind("file")}>
            <Upload size={16} /> {t("importAsUrinamu")}
          </button>
        </div>
        <p className="hint">{t("importChooseHint")}</p>
      </Modal>
    );
  if (kind === "choose")
    return (
      <Modal title={t("exportChooseTitle")} onClose={onClose}>
        <p>{t("exportChooseBody")}</p>
        <div className="actions export-choices">
          <button
            type="button"
            className="primary"
            disabled={!family.members.length}
            onClick={() => {
              onPdf(includeData);
              onClose();
            }}
          >
            <FileImage size={16} /> {t("exportAsPdf")}
          </button>
          <button type="button" onClick={() => setKind("file")}>
            <Download size={16} /> {t("exportAsUrinamu")}
          </button>
        </div>
        <label className="choice-check">
          <input
            type="checkbox"
            checked={includeData}
            onChange={(event) => setIncludeData(event.target.checked)}
          />
          {t("exportPdfInclude")}
        </label>
        <p className="hint">{t("exportChooseHint")}</p>
      </Modal>
    );
  return (
    <Modal
      title={mode === "export" ? t("shareTitle") : t("openFileTitle")}
      onClose={() => !busy && onClose()}
    >
      <p>{mode === "export" ? t("shareBody") : t("openFileBody")}</p>
      {!desktop && <p className="form-error">{t("desktopOnlyExchange")}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (mode === "export" && password !== repeat) {
            setError(t("passwordMismatch"));
            return;
          }
          setBusy(true);
          setError("");
          try {
            if (mode === "export") {
              if (await exportFamily(family, password)) {
                onNotice(t("exported"));
                onClose();
              }
            } else {
              const f = await importFamily(password);
              if (
                f &&
                (await ask(
                  t("importAsk", { name: f.name, count: f.members.length }),
                ))
              ) {
                if (await onImport(f)) {
                  onNotice(t("imported"));
                  onClose();
                }
              }
            }
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          <label>
            {t("password")}
            <input
              autoComplete="off"
              type="password"
              required
              minLength={mode === "export" ? 10 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          {mode === "export" && (
            <label>
              {t("repeatPassword")}
              <input
                autoComplete="off"
                type="password"
                required
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
        </div>
        {mode === "export" && <p className="hint">{t("guideExportHint")}</p>}
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy || !desktop}>
            <LockKeyhole size={16} />
            {busy
              ? t("working")
              : mode === "export"
                ? t("exportEncrypted")
                : t("chooseAndDecrypt")}
          </button>
        </div>
      </form>
      <p className="hint">{lines(t("cryptoHint"))}</p>
    </Modal>
  );
}
