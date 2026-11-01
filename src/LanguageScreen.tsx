import { Logo } from "./Logo";
import { t, type Locale, locales, languageName } from "./i18n";

export default function LanguageScreen({
  onChoose,
}: {
  onChoose: (language: Locale) => void;
}) {
  return (
    <div className="welcome language-gate">
      <Logo tagline={false} />
      <h1>Sprache · Language · 언어</h1>
      <p>
        {t("languagePromptDe")}
        <br />
        {t("languagePromptEn")}
        <br />
        {t("languagePromptKo")}
      </p>
      <div className="actions language-choices">
        {locales.map((locale) => (
          <button key={locale} type="button" onClick={() => onChoose(locale)}>
            {languageName[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
