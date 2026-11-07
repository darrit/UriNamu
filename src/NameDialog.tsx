import { useState } from "react";
import { Modal } from "./Modal";
import { t, type Locale, locales, languageName } from "./i18n";

export default function NameDialog({
  name,
  busy,
  askDescendants,
  removeDescendants,
  showPartnerSlots,
  language,
  onAskDescendants,
  onRemoveDescendants,
  onShowPartnerSlots,
  onLanguage,
  onSave,
  onClose,
}: {
  name: string;
  busy: boolean;
  askDescendants: boolean;
  removeDescendants: boolean;
  showPartnerSlots: boolean;
  language: Locale;
  onAskDescendants: (value: boolean) => void;
  onRemoveDescendants: (value: boolean) => void;
  onShowPartnerSlots: (value: boolean) => void;
  onLanguage: (value: Locale) => void;
  onSave: (s: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <Modal title={t("settings")} onClose={() => !busy && onClose()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value.trim());
        }}
      >
        <label className="fields">
          {t("treeName")}
          <input
            required
            maxLength={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="fields">
          {t("language")}
          <select
            value={language}
            onChange={(e) => onLanguage(e.target.value as Locale)}
          >
            {locales.map((locale) => (
              <option key={locale} value={locale} lang={locale}>
                {languageName[locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="choice-check">
          <input
            type="checkbox"
            checked={askDescendants}
            onChange={(e) => onAskDescendants(e.target.checked)}
          />
          {t("askDescendants")}
        </label>
        {!askDescendants && (
          <label className="fields">
            {t("withoutQuestion")}
            <select
              value={removeDescendants ? "tree" : "person"}
              onChange={(e) => onRemoveDescendants(e.target.value === "tree")}
            >
              <option value="person">{t("removePersonOnly")}</option>
              <option value="tree">{t("removePersonAndDescendants")}</option>
            </select>
          </label>
        )}
        <label className="choice-check">
          <input
            type="checkbox"
            checked={showPartnerSlots}
            onChange={(e) => onShowPartnerSlots(e.target.checked)}
          />
          {t("showPartnerSlots")}
        </label>
        <div className="actions">
          <button className="primary" disabled={busy || !value.trim()}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
