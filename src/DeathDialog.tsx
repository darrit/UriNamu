import { useState } from "react";
import { Modal } from "./Modal";
import { t, shown } from "./i18n";
import { type Person, displayName } from "./domain";
import DateField from "./DateField";
import { dateValue } from "./dates";

export default function DeathDialog({
  person,
  busy,
  onClose,
  onSave,
}: {
  person: Person;
  busy: boolean;
  onClose: () => void;
  onSave: (value: string, deceased: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(person.died);
  const [error, setError] = useState("");
  const save = async (died: string, deceased: boolean) => {
    setError("");
    try {
      await onSave(died, deceased);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <Modal
      title={
        person.died || person.deceased ? t("changeDeath") : t("markDeceased")
      }
      onClose={onClose}
    >
      <p>{displayName(person)}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const died = dateValue(value);
          if (!died) {
            setError(t("enterDeath"));
            return;
          }
          void save(died, false);
        }}
      >
        <div className="fields">
          <DateField
            label={t("deathDate")}
            value={value}
            example="2020-07-15"
            required
            autoFocus
            disabled={busy}
            onChange={setValue}
          />
        </div>
        <p className="hint">{t("deathHint")}</p>
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy}>
            {t("saveDeath")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save("", true)}
          >
            {t("markDeathUnknown")}
          </button>
          {(person.died || person.deceased) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("", false)}
            >
              {t("clearDeath")}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
