import { Logo } from "./Logo";
import { type Locale, locales, languageName, languagePrompt } from "./i18n";

export default function LanguageScreen({
  onChoose,
}: {
  onChoose: (language: Locale) => void;
}) {
  return (
    <div className="welcome language-gate">
      <Logo tagline={false} />
      <h1>Sprache · Language · 言語 · 언어</h1>
      <p>
        {locales.map((locale) => (
          <span key={locale} lang={locale}>
            {languagePrompt(locale)}
            <br />
          </span>
        ))}
      </p>
      <div className="actions language-choices">
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => onChoose(locale)}
          >
            {languageName[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
