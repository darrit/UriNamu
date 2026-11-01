import { t } from "./i18n";

export function Logo({
  onVersion,
  tagline = true,
}: {
  onVersion?: () => void;
  tagline?: boolean;
}) {
  return (
    <div className="brand">
      <div className="brand-symbol">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path
            d="M10 19V43H54V61"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <path d="M32 5V34" stroke="#A58A56" strokeWidth="7" />
        </svg>
      </div>
      <div>
        <span className="brand-title">
          <span className="wordmark">
            <span className="wordmark-uri">Uri</span>
            <span className="wordmark-namu">Namu</span>
          </span>
          {onVersion ? (
            <button
              className="app-version"
              aria-label={t("showBuild")}
              onClick={onVersion}
              title={t("versionBuild", {
                version: __APP_VERSION__,
                time: __BUILD_TIME__,
              })}
            >
              v{__APP_VERSION__}
            </button>
          ) : (
            <span className="app-version">v{__APP_VERSION__}</span>
          )}
        </span>
        {tagline && <small>{t("tagline")}</small>}
      </div>
    </div>
  );
}
