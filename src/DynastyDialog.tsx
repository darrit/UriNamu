import { useState } from "react";
import { Modal } from "./Modal";
import { t, shown } from "./i18n";
import { type Person, type Dynasty } from "./domain";
import { fitLogo } from "./storage";

export default function DynastyDialog({
  person,
  busy,
  onClose,
  onSave,
}: {
  person: Person;
  busy: boolean;
  onClose: () => void;
  onSave: (dynasty: Dynasty | null) => Promise<string>;
}) {
  const [name, setName] = useState(person.dynasty?.name ?? ""),
    [corner, setCorner] = useState<"left" | "right">(
      person.dynasty?.corner ?? "left",
    ),
    [logo, setLogo] = useState(person.dynasty?.logo ?? ""),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false);
  return (
    <Modal title={t("dynastyTitle")} onClose={onClose}>
      <p>{t("dynastyBody")}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed || trimmed.length > 80) {
            setError(t("errDynastyName"));
            return;
          }
          setError(await onSave({ name: trimmed, logo, corner }));
        }}
      >
        <div className="fields">
          <label>
            {t("dynastyName")}
            <input
              required
              maxLength={80}
              value={name}
              disabled={busy || reading}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div>
            <span className="field-caption">{t("dynastyCorner")}</span>
            <div className="dynasty-corner">
              <button
                type="button"
                aria-pressed={corner === "left"}
                disabled={busy || reading}
                onClick={() => setCorner("left")}
              >
                {t("dynastyLeft")}
              </button>
              <button
                type="button"
                aria-pressed={corner === "right"}
                disabled={busy || reading}
                onClick={() => setCorner("right")}
              >
                {t("dynastyRight")}
              </button>
            </div>
          </div>
          <label>
            {t("dynastyLogo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              disabled={busy || reading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setReading(true);
                setError("");
                try {
                  setLogo(await fitLogo(file));
                } catch (err) {
                  setError(String(err));
                } finally {
                  setReading(false);
                }
              }}
            />
            <small className="field-hint">{t("photoHint")}</small>
          </label>
          {logo && <img className="dynasty-logo-preview" src={logo} alt="" />}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button
            className="primary"
            disabled={busy || reading || !name.trim()}
          >
            {t("dynastySave")}
          </button>
          {person.dynasty && (
            <button
              type="button"
              className="danger"
              disabled={busy || reading}
              onClick={async () => setError(await onSave(null))}
            >
              {t("dynastyRemove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
