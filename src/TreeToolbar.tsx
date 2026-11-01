import type { Dispatch, SetStateAction } from "react";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  TreePine,
  Columns3,
  Sparkles,
  ScrollText,
  Search,
} from "lucide-react";
import type { Layout } from "./layout";
import { t } from "./i18n";

export function TreeToolbar({
  toolsOpen,
  setToolsOpen,
  busy,
  add,
  layout,
  setLayout,
  setPage,
  query,
  setQuery,
}: {
  toolsOpen: boolean;
  setToolsOpen: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  add: () => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  setPage: (page: "tree") => void;
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="page-head">
      <div className="page-head-bar">
        <button
          className="head-toggle"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((open) => !open)}
        >
          {toolsOpen ? (
            <>
              <ChevronUp size={15} /> {t("collapse")}
            </>
          ) : (
            <>
              <ChevronDown size={15} /> {t("expand")}
            </>
          )}
        </button>
      </div>
      {toolsOpen && (
        <>
          <section className="intro">
            <div>
              <div className="eyebrow">{t("introEyebrow")}</div>
              <h1>{t("introTitle")}</h1>
              <p>{t("introBody")}</p>
            </div>
            <button
              id="add-member"
              className="primary"
              disabled={busy}
              onClick={() => add()}
            >
              <Plus size={17} /> {t("addMember")}
            </button>
          </section>
          <div className="toolbar">
            <div className="tabs">
              {(
                [
                  ["classic", "layoutClassic", TreePine],
                  ["horizontal", "layoutHorizontal", Columns3],
                  ["tapestry", "layoutTapestry", Sparkles],
                  ["chart", "layoutChart", ScrollText],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={layout === id ? "active" : ""}
                  onClick={() => {
                    setLayout(id);
                    setPage("tree");
                  }}
                >
                  <Icon size={14} />
                  {t(label)}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchLabel")}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
