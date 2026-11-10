import { useState } from "react";
import { Modal } from "./Modal";
import { t, shown } from "./i18n";
import { type Union, type Marriage } from "./domain";
import DateField from "./DateField";

export default function MarriageDialog({
  union,
  busy,
  onClose,
  onSave,
}: {
  union: Union;
  busy: boolean;
  onClose: () => void;
  onSave: (value: Marriage | "separated", marriedOn: string) => Promise<string>;
}) {
  const [value, setValue] = useState<Marriage | "separated">(
      union.status === "separated" && union.marriage === "unspecified"
        ? "separated"
        : union.marriage || "unspecified",
    ),
    [marriedOn, setMarriedOn] = useState(union.marriedOn || ""),
    [error, setError] = useState("");
  return (
    <Modal title={t("marriageTitle")} onClose={onClose}>
      <p>{t("marriageBody")}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(await onSave(value, marriedOn));
        }}
      >
        <div className="fields">
          <label>
            {t("maritalLabel")}
            <select
              aria-label={t("maritalLabel")}
              value={value}
              disabled={busy}
              onChange={(e) =>
                setValue(e.target.value as Marriage | "separated")
              }
            >
              <option value="separated">{t("separated")}</option>
              <option value="unspecified">{t("unspecified")}</option>
              <option value="married">{t("married")}</option>
              <option value="divorced">{t("divorced")}</option>
            </select>
          </label>
          {(value === "married" || value === "divorced") && (
            <DateField
              label={t("weddingDateOptional")}
              value={marriedOn}
              example="1984-06-18"
              disabled={busy}
              onChange={setMarriedOn}
            />
          )}
        </div>
        <p className="hint">{t("marriageHint")}</p>
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy}>
            {t("saveMarriage")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
