import MergeDialog from "./MergeDialog";
import LibraryDialog from "./LibraryDialog";
import { GuideBeatCard, GuideBook, type GuideChapter } from "./GuidePanel";
import { PdfJob } from "./PdfJob";
import { pdfFileName, savePdfFile } from "./savePdf";
import {
  guideBeat,
  guideStepAfterFamily,
  nextGuideStep,
  type GuideStep,
} from "./guide";
import PhotoCrop from "./PhotoCrop";
import DateField from "./DateField";
import { dateLabel, dateValue } from "./dates";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  Search,
  Users,
  Network,
  Download,
  FileImage,
  Upload,
  History,
  Undo2,
  Redo2,
  Pencil,
  X,
  Trash2,
  Check,
  LockKeyhole,
  ImagePlus,
  Settings,
  Leaf,
  GitMerge,
  FolderTree,
  TreePine,
  Columns3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";
import {
  type Family,
  type Person,
  type Union,
  type Marriage,
  type Dynasty,
  newPerson,
  normalize,
  validate,
  assignMarriage,
  updatePerson,
  removePerson,
  descendantIds,
  childrenOf,
  unionKey,
  symbol,
  years,
  displayName,
  matchesQuery,
  nameInputs,
  setDeathDate,
} from "./domain";
import {
  desktop,
  createTree,
  deleteTree,
  renameTree as saveTreeName,
  switchTree,
  loadFamily,
  saveFamily,
  exportFamily,
  importFamily,
  revisions,
  revision,
  fitLogo,
  imageByteLimit,
  type Revision,
} from "./storage";
import Tree, { Portrait } from "./Tree";
import { type Layout, preserveLayout, tidyLayout } from "./layout";
import {
  loadPreferences,
  savePreferences,
  type Preferences,
} from "./preferences";
import demo from "./demo.json";
import {
  languageName,
  locales,
  localeTag,
  setLocale,
  shown,
  t,
  text,
  type Locale,
} from "./i18n";
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
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  dismissOnBackdrop = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  dismissOnBackdrop?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "wide" : ""} ${className}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon" aria-label={t("close")} onClick={onClose}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
interface EditorState {
  person: Person;
  editing: boolean;
  partner: string;
  fresh: boolean;
  childForParent?: string;
}
export default function App() {
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [family, setFamily] = useState<Family | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const working = useRef(false);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [layout, setLayout] = useState<Layout>("tapestry"),
    [focus, setFocus] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [page, setPage] = useState<"tree" | "members">("tree"),
    [editor, setEditor] = useState<EditorState | null>(null),
    [branch, setBranch] = useState<Union | null>(null),
    [transfer, setTransfer] = useState<"export" | "import" | null>(null),
    [pdfFamily, setPdfFamily] = useState<Family | null>(null),
    [pdfStep, setPdfStep] = useState<{ done: number; total: number } | null>(
      null,
    ),
    [settings, setSettings] = useState(false),
    [buildInfo, setBuildInfo] = useState(false),
    [library, setLibrary] = useState(false),
    [guideOpen, setGuideOpen] = useState(false),
    [guideChapter, setGuideChapter] = useState<GuideChapter>("person"),
    [merging, setMerging] = useState(false),
    [marriageUnion, setMarriageUnion] = useState<Union | null>(null),
    [dynastyPerson, setDynastyPerson] = useState<Person | null>(null),
    [deathPersonId, setDeathPersonId] = useState<string | null>(null),
    [history, setHistory] = useState<Revision[] | null>(null),
    [undo, setUndo] = useState<Family[]>([]),
    [redo, setRedo] = useState<Family[]>([]);
  const [question, setQuestion] = useState<{
    text: string;
    title?: string;
    confirm?: string;
    cancel?: string;
    danger?: boolean;
    resolve: (yes: boolean) => void;
  } | null>(null);
  const [removePrompt, setRemovePrompt] = useState<{
    id: string;
    count: number;
    hide: boolean;
    resolve: (choice: "cancel" | "person" | "tree") => void;
  } | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  if (preferences.language) setLocale(preferences.language);
  const ask = (
    text: string,
    labels?: {
      title?: string;
      confirm?: string;
      cancel?: string;
      danger?: boolean;
    },
  ) =>
    new Promise<boolean>((resolve) =>
      setQuestion({ text, resolve, ...labels }),
    );
  const askDescendants = (id: string, count: number) =>
    new Promise<"cancel" | "person" | "tree">((resolve) =>
      setRemovePrompt({ id, count, hide: false, resolve }),
    );
  const updatePreferences = (next: Preferences) => {
    setPreferences(next);
    savePreferences(next);
  };
  const settleGuide = (step: GuideStep) => {
    updatePreferences({ ...preferences, guideStep: step });
    document.getElementById("add-member")?.focus();
  };
  const guideBlocked = Boolean(
    editor ||
      settings ||
      library ||
      merging ||
      transfer ||
      history ||
      question ||
      removePrompt ||
      deathPersonId ||
      dynastyPerson ||
      marriageUnion ||
      buildInfo ||
      branch ||
      guideOpen,
  );
  const beat =
    family && page === "tree" && !guideBlocked
      ? guideBeat(
          preferences.guideStep,
          family.members.length,
          family.unions.length,
        )
      : null;
  useEffect(() => {
    let mounted = true;
    loadFamily()
      .then((f) => {
        if (mounted) setFamily(f);
      })
      .catch((e) => {
        if (mounted) setLoadError(String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    document.documentElement.lang = preferences.language ?? "de";
    if (preferences.language) document.title = t("documentTitle");
  }, [preferences.language]);
  useEffect(() => {
    if (!family) return;
    const next = guideStepAfterFamily(
      preferences.guideStep,
      family.members.length,
    );
    if (next === preferences.guideStep) return;
    updatePreferences({ ...preferences, guideStep: next });
  }, [family, preferences]);
  async function commit(next: Family, label: string, record = true) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      validate(next);
      next = preserveLayout(family, next);
      validate(next);
      await saveFamily(next, label);
      if (record && family) {
        setUndo((h) => [...h.slice(-29), family]);
        setRedo([]);
      }
      setFamily(next);
      setNotice(t("saved", { label: text(label) }));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function toggleDynastyJoin(personId: string, founderId: string) {
    if (!family) return;
    const next = structuredClone(family);
    const person = next.members.find((p) => p.id === personId);
    const founder = next.members.find((p) => p.id === founderId);
    if (!person || !founder?.dynasty) return;
    const joined = new Set(person.dynastyWith ?? []);
    if (joined.has(founderId)) joined.delete(founderId);
    else joined.add(founderId);
    if (joined.size) person.dynastyWith = [...joined];
    else delete person.dynastyWith;
    void commit(next, "logDynasty");
  }
  async function newTree(next: Family, label: string) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await createTree(next, label);
      setCanvasEpoch((epoch) => epoch + 1);
      setFamily(next);
      setUndo([]);
      setRedo([]);
      setFocus(null);
      setQuery("");
      setPage("tree");
      setNotice(text(label));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function openTree(id: string) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await switchTree(id);
      setCanvasEpoch((epoch) => epoch + 1);
      setFamily(next);
      setUndo([]);
      setRedo([]);
      setFocus(null);
      setQuery("");
      setPage("tree");
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function removeTree(tree: { id: string; name: string }) {
    if (working.current) return false;
    if (
      !(await ask(
        t("deleteTreeBody", { name: tree.name }),
        {
          title: t("deleteTreeTitle"),
          confirm: t("delete"),
          cancel: t("cancel"),
          danger: true,
        },
      ))
    )
      return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await deleteTree(tree.id);
      if (result.changed) {
        setCanvasEpoch((epoch) => epoch + 1);
        setFamily(result.family);
        setUndo([]);
        setRedo([]);
        setFocus(null);
        setQuery("");
        setEditor(null);
        setPage("tree");
        if (!result.family) setLibrary(false);
      }
      setNotice(t("treeDeleted"));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function renameTree(
    tree: { id: string; name: string; current: boolean },
    name: string,
  ) {
    const nextName = name.trim();
    if (!nextName || nextName.length > 100) {
      setError(t("errName"));
      return false;
    }
    if (nextName === tree.name) return true;
    if (tree.current && family) {
      const ok = await commit({ ...family, name: nextName }, "logRenamed");
      if (ok) setNotice(t("treeRenamed"));
      return ok;
    }
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await saveTreeName(tree.id, nextName);
      setNotice(t("treeRenamed"));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const openPerson = (p: Person, editing = false) => {
    const u = family!.unions.find(
      (u) => u.status === "active" && (u.a === p.id || u.b === p.id),
    );
    setEditor({
      person: structuredClone(p),
      partner: u ? (u.a === p.id ? u.b : u.a) : "",
      fresh: false,
      editing,
    });
  };
  const addAncestor = (childId: string, _index: number) => {
    const child = family!.members.find((p) => p.id === childId)!;
    if (child.parents.length >= 2) return;
    const p = newPerson();
    const other = child.parents[0];
    const partner =
      other &&
      !family!.unions.some(
        (u) => u.status === "active" && (u.a === other || u.b === other),
      )
        ? other
        : "";
    setEditor({
      person: p,
      partner,
      fresh: true,
      editing: true,
      childForParent: childId,
    });
  };
  const add = (partner = "", parents: string[] = []) => {
    const p = newPerson();
    p.parents = parents;
    setEditor({ person: p, partner, fresh: true, editing: true });
  };
  const requestRemove = async (id: string) => {
    if (!family || busy || working.current) return;
    const person = family.members.find((p) => p.id === id);
    if (!person) return;
    const descendants = descendantIds(family, id);
    let withDescendants = false;
    if (descendants.length) {
      if (preferences.askRemoveDescendants) {
        const choice = await askDescendants(id, descendants.length);
        if (choice === "cancel") return;
        withDescendants = choice === "tree";
      } else withDescendants = preferences.removeDescendants;
    }
    if (!descendants.length || !preferences.askRemoveDescendants) {
      const question = withDescendants
        ? t("removeWithDescendants", {
            name: displayName(person),
            count: descendants.length,
          })
        : t("removePersonAsk", { name: displayName(person) });
      if (!(await ask(question))) return;
    }
    const removed = new Set(withDescendants ? [id, ...descendants] : [id]);
    if (
      await commit(
        removePerson(family, id, withDescendants),
        withDescendants ? "logDescendantsRemoved" : "logMemberRemoved",
      )
    ) {
      setEditor((current) =>
        current && removed.has(current.person.id) ? null : current,
      );
      if (focus && removed.has(focus)) setFocus(null);
      if (deathPersonId && removed.has(deathPersonId)) setDeathPersonId(null);
    }
  };
  const confirmDeathChange = (person: Person, died: string) => {
    if (person.died === died) return Promise.resolve(true);
    const action = !died
      ? t("clearDeceased")
      : person.died
        ? t("changeDeath")
        : t("markDeceased");
    return ask(
      t("deathAsk", {
        action,
        name: displayName(person),
        detail: died
          ? t("deathDetailSet", { date: dateLabel(died) })
          : t("deathDetailClear"),
      }),
    );
  };
  async function separate(u: Union) {
    if (
      !family ||
      !(await ask(
        t("divorceAsk"),
      ))
    )
      return;
    const next = structuredClone(family);
    next.unions.find((x) => x.id === u.id)!.status = "separated";
    next.unions.find((x) => x.id === u.id)!.marriage = "divorced";
    if (await commit(next, "logDivorced")) setEditor(null);
  }
  async function undoAction(forward = false) {
    const source = forward ? redo : undo;
    if (!family || !source.length || busy) return;
    const previous = source[source.length - 1];
    if (
      await commit(
        previous,
        forward ? "logRedone" : "logUndone",
        false,
      )
    ) {
      if (forward) {
        setRedo((h) => h.slice(0, -1));
        setUndo((h) => [...h, family]);
      } else {
        setUndo((h) => h.slice(0, -1));
        setRedo((h) => [...h, family]);
      }
      setFocus(null);
    }
  }
  const showHistory = async () => {
    try {
      setHistory(await revisions());
    } catch (e) {
      setError(String(e));
    }
  };
  if (!preferences.language)
    return (
      <LanguageScreen
        onChoose={(language) => updatePreferences({ ...preferences, language })}
      />
    );
  if (loading)
    return (
      <div className="loading">
        <Logo />
        <p>{t("loading")}</p>
      </div>
    );
  return (
    <>
      <header className="topbar">
        <Logo onVersion={() => setBuildInfo(true)} />
        <div className="header-actions">
          <span className="saved">
            <Check size={13} />
            {busy
              ? t("savingState")
              : desktop
                ? t("savedLocal")
                : t("browserPreview")}
          </span>
          <button
            disabled={busy || !undo.length}
            aria-label={t("undo")}
            onClick={() => undoAction()}
          >
            <Undo2 size={16} />
          </button>
          <button
            disabled={busy || !redo.length}
            aria-label={t("redo")}
            onClick={() => undoAction(true)}
          >
            <Redo2 size={16} />
          </button>
          <button
            disabled={busy || !!loadError}
            onClick={() => setTransfer("import")}
          >
            <Upload size={15} /> {t("import")}
          </button>
          <button
            className="primary"
            disabled={!family || busy || !!pdfFamily}
            onClick={() => setTransfer("export")}
          >
            <Download size={15} />{" "}
            {pdfFamily && pdfStep
              ? t("exportPdfBusy", pdfStep)
              : t("export")}
          </button>
        </div>
      </header>
      {(error || loadError) && (
        <div className="error-banner" role="alert">
          {shown(error || loadError || "")}
          {error && (
            <button
              onClick={() => setError("")}
              aria-label={t("dismissError")}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {!family ? (
        <div className="welcome">
          <div className="eyebrow">{t("welcomeEyebrow")}</div>
          <h1>{lines(t("welcomeTitle"))}</h1>
          <p>{lines(t("welcomeBody"))}</p>
          {loadError ? (
            <p>{t("welcomeLoadError")}</p>
          ) : (
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  commit(
                    {
                      version: 2,
                      name: t("defaultFamily"),
                      members: [],
                      unions: [],
                    },
                    "logFamilyCreated",
                  )
                }
              >
                <Plus size={17} /> {t("startFamily")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  commit(normalize(demo), "logDemoLoaded")
                }
              >
                {t("exploreDemo")}
              </button>
            </div>
          )}
          <small>
            {desktop ? t("welcomeDesktop") : t("welcomeBrowser")}
          </small>
        </div>
      ) : (
        <div className="shell">
          <aside>
            <div className="label">{t("archiveLabel")}</div>
            <button
              className={page === "tree" ? "nav active" : "nav"}
              onClick={() => setPage("tree")}
            >
              <Network size={17} /> {t("navTree")}
            </button>
            <button
              className={page === "members" ? "nav active" : "nav"}
              onClick={() => setPage("members")}
            >
              <Users size={17} /> {t("navMembers")}{" "}
              <small>{family.members.length}</small>
            </button>
            <div className="family-summary">
              <Leaf size={27} />
              <span>{t("ourTree")}</span>
              <strong>{family.name}</strong>
              <p>{t("everyBond")}</p>
            </div>
            <button className="nav" onClick={() => setLibrary(true)}>
              <FolderTree size={17} /> {t("myTrees")}
            </button>
            <button className="nav" onClick={() => setMerging(true)}>
              <GitMerge size={17} /> {t("merge")}
            </button>
            <button className="nav" onClick={showHistory}>
              <History size={17} /> {t("history")}
            </button>
            <button className="nav" onClick={() => setSettings(true)}>
              <Settings size={17} /> {t("settings")}
            </button>
            <button
              className="nav"
              onClick={() => {
                setGuideChapter("person");
                setGuideOpen(true);
              }}
            >
              <BookOpen size={17} /> {t("guide")}
            </button>
            <div className="side-bottom">
              {lines(t("sideMotto"))}
              <p>
                <LockKeyhole size={12} />{" "}
                {desktop ? t("dataStays") : t("previewShort")}
              </p>
              <small>
                <span className="wordmark-uri">Uri</span>
                <span className="wordmark-namu">Namu</span>
                {t("versionLine")}
                {__APP_VERSION__}
              </small>
            </div>
          </aside>
          <main>
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
                      <div className="eyebrow">
                        {t("introEyebrow")}
                      </div>
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
            {page === "tree" ? (
              <Tree
                key={canvasEpoch}
                family={family}
                layout={layout}
                query={query}
                focus={focus}
                onFocus={setFocus}
                onMove={async (id, point) => {
                  const next = structuredClone(family);
                  const person = next.members.find((p) => p.id === id);
                  if (!person) return false;
                  person.positions = { ...person.positions, [layout]: point };
                  return commit(next, "logMoved");
                }}
                onMovePair={async (ids, points) => {
                  const next = structuredClone(family);
                  for (const id of ids) {
                    const person = next.members.find((p) => p.id === id);
                    if (!person || !points[id]) return false;
                    person.positions = {
                      ...person.positions,
                      [layout]: points[id],
                    };
                  }
                  return commit(next, "logPairMoved");
                }}
                showPartnerSlots={preferences.showPartnerSlots}
                onTidy={() => {
                  void commit(
                    tidyLayout(family, layout, preferences.showPartnerSlots),
                    "logTidied",
                  );
                }}
                onEdit={(p) => openPerson(p)}
                onPartner={(id) => add(id)}
                onBranch={(id) =>
                  setBranch(family.unions.find((u) => u.id === id)!)
                }
                onAncestor={addAncestor}
                onChild={(parentId) => add("", [parentId])}
                onDeath={setDeathPersonId}
                onRemove={(id) => {
                  void requestRemove(id);
                }}
                onSeparate={(id) => {
                  const u = family.unions.find((u) => u.id === id);
                  if (u) void separate(u);
                }}
                onDynasty={(id) => {
                  const person = family.members.find((p) => p.id === id);
                  if (person) setDynastyPerson(person);
                }}
                onJoinDynasty={toggleDynastyJoin}
                guidePersonId={
                  beat === "person" ? family.members[0]?.id ?? null : null
                }
                guide={
                  beat && (
                    <GuideBeatCard
                      beat={beat}
                      onNext={() =>
                        settleGuide(nextGuideStep(preferences.guideStep))
                      }
                      onSkip={() => settleGuide(4)}
                    />
                  )
                }
              />
            ) : (
              <div className="member-grid">
                {family.members
                  .map((p) => (
                    <button
                      key={p.id}
                      className={`member-row${
                        matchesQuery(p, query) ? "" : " search-miss"
                      }`}
                      onClick={() => openPerson(p)}
                    >
                      <Portrait p={p} />
                      <span>
                        <strong>
                          {symbol(p)} {displayName(p)}
                        </strong>
                        <small>{years(p)}</small>
                      </span>
                      <Pencil size={14} />
                    </button>
                  ))}
                {!family.members.length && (
                  <p>{t("noMembersYet")}</p>
                )}
              </div>
            )}
            <footer>
              <span>
                ✦ &nbsp; <span className="wordmark-uri">Uri</span>
                <span className="wordmark-namu">Namu</span> v{__APP_VERSION__} ·
                {t("footerMotto")}
              </span>
              <span>
                {desktop
                  ? t("footerDesktop")
                  : t("browserPreview")}
              </span>
            </footer>
          </main>
        </div>
      )}
      {buildInfo && (
        <Modal title={t("buildTitle")} onClose={() => setBuildInfo(false)}>
          <dl className="build-info">
            <dt>{t("appVersion")}</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>{import.meta.env.DEV ? t("devStart") : t("buildTime")}</dt>
            <dd>
              <time dateTime={__BUILD_TIME__}>
                {new Intl.DateTimeFormat(localeTag[preferences.language || "de"], {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZoneName: "short",
                }).format(new Date(__BUILD_TIME__))}
              </time>
            </dd>
            <dt>{t("runtime")}</dt>
            <dd>{desktop ? t("desktopApp") : t("browserPreview")}</dd>
          </dl>
        </Modal>
      )}
      {editor && family && (
        <PersonEditor
          key={editor.person.id}
          initial={editor}
          family={family}
          busy={busy}
          ask={ask}
          onClose={() => setEditor(null)}
          onSeparate={separate}
          onMarriage={setMarriageUnion}
          onDynasty={(id) => {
            const person = family.members.find((p) => p.id === id);
            if (person) setDynastyPerson(person);
          }}
          onJoinDynasty={toggleDynastyJoin}
          onSave={async (p, partner) => {
            try {
              let next = updatePerson(family, p, partner);
              const original = family.members.find(
                (person) => person.id === p.id,
              ) || { ...p, died: "" };
              if (!(await confirmDeathChange(original, p.died))) return;
              if (editor.childForParent) {
                const child = next.members.find(
                  (x) => x.id === editor.childForParent,
                )!;
                const childPartner = next.unions.find(
                  (u) =>
                    u.status === "active" &&
                    (u.a === child.id || u.b === child.id),
                );
                next = updatePerson(
                  next,
                  { ...child, parents: [...child.parents, p.id] },
                  childPartner
                    ? childPartner.a === child.id
                      ? childPartner.b
                      : childPartner.a
                    : "",
                );
              }
              if (
                await commit(
                  next,
                  editor.childForParent
                    ? "logAncestorAdded"
                    : editor.fresh
                      ? "logMemberAdded"
                      : "logProfileUpdated",
                )
              )
                setEditor(null);
              else
                throw Error(
                  t("saveFailed"),
                );
            } catch (e) {
              setError(String(e));
              throw e;
            }
          }}
          onRemove={() => {
            void requestRemove(editor.person.id);
          }}
        />
      )}
      {deathPersonId &&
        family &&
        family.members.some((p) => p.id === deathPersonId) && (
          <DeathDialog
            person={family.members.find((p) => p.id === deathPersonId)!}
            busy={busy}
            onClose={() => {
              if (!busy) setDeathPersonId(null);
            }}
            onSave={async (died) => {
              const next = setDeathDate(family, deathPersonId, died);
              const person = family.members.find(
                (p) => p.id === deathPersonId,
              )!;
              if (!(await confirmDeathChange(person, died))) return;
              if (
                await commit(
                  next,
                  died ? "logDeathSet" : "logDeathCleared",
                )
              )
                setDeathPersonId(null);
              else
                throw Error(t("deathSaveFailed"));
            }}
          />
        )}
      {branch && family && (
        <Modal title={t("newBranch")} onClose={() => !busy && setBranch(null)}>
          <p>
            {displayName(family.members.find((p) => p.id === branch.a))} &amp;{" "}
            {displayName(family.members.find((p) => p.id === branch.b))}
          </p>
          <div className="branch-count">
            {t("sharedChildren", { count: childrenOf(family, branch).length })}
          </div>
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                add("", [branch.a, branch.b]);
                setBranch(null);
              }}
            >
              <Plus size={16} /> {t("addChild")}
            </button>
            {!childrenOf(family, branch).length && (
              <button
                disabled={busy}
                onClick={async () => {
                  const next = structuredClone(family);
                  const union = next.unions.find((u) => u.id === branch.id)!;
                  union.childPrompt = false;
                  if (await commit(next, "logNoChildren"))
                    setBranch(null);
                }}
              >
                {t("noAnswer")}
              </button>
            )}
            {!childrenOf(family, branch).length && (
              <button
                disabled={busy}
                onClick={async () => {
                  const next = structuredClone(family);
                  next.unions.find((u) => u.id === branch.id)!.ended =
                    !branch.ended;
                  if (
                    await commit(
                      next,
                      branch.ended
                        ? "logLineReopened"
                        : "logLineClosed",
                    )
                  )
                    setBranch(null);
                }}
              >
                {branch.ended
                  ? t("reopenLine")
                  : t("closeLine")}
              </button>
            )}
          </div>
          <p className="hint">
            {t("lineHint")}
          </p>
        </Modal>
      )}
      {transfer && (
        <Transfer
          mode={transfer}
          family={
            family || {
              version: 2,
              name: t("defaultFamily"),
              members: [],
              unions: [],
            }
          }
          onClose={() => setTransfer(null)}
          ask={ask}
          onImport={(f) => newTree(f, "logImported")}
          onNotice={setNotice}
          onPdf={() => {
            if (!family?.members.length) return;
            setPdfStep(null);
            setPdfFamily(structuredClone(family));
          }}
        />
      )}
      {pdfFamily && (
        <PdfJob
          family={pdfFamily}
          layout={layout}
          onProgress={(done, total) => setPdfStep({ done, total })}
          onDone={(bytes) => {
            const name = pdfFileName(pdfFamily.name);
            void savePdfFile(name, bytes)
              .catch((error) => setError(String(error)))
              .finally(() => {
                setPdfFamily(null);
                setPdfStep(null);
              });
          }}
          onError={(error) => {
            if (error instanceof Error && error.message === "cancelled") return;
            setError(t("exportPdfFailed"));
            setPdfFamily(null);
            setPdfStep(null);
          }}
        />
      )}
      {library && (
        <LibraryDialog
          busy={busy}
          onClose={() => setLibrary(false)}
          onOpen={openTree}
          onNew={(f) => newTree(f, "logTreeCreated")}
          onDelete={removeTree}
          onRename={renameTree}
        />
      )}
      {merging && family && (
        <MergeDialog
          family={family}
          onClose={() => setMerging(false)}
          onMerged={(f) => newTree(f, "logMerged")}
        />
      )}
      {dynastyPerson && family && (
        <DynastyDialog
          person={
            family.members.find((p) => p.id === dynastyPerson.id) ??
            dynastyPerson
          }
          busy={busy}
          onClose={() => !busy && setDynastyPerson(null)}
          onSave={async (dynasty) => {
            const next = structuredClone(family),
              person = next.members.find((p) => p.id === dynastyPerson.id);
            if (!person) return t("errMissingPerson");
            if (dynasty) person.dynasty = dynasty;
            else {
              delete person.dynasty;
              for (const member of next.members) {
                if (!member.dynastyWith?.includes(person.id)) continue;
                member.dynastyWith = member.dynastyWith.filter(
                  (id) => id !== person.id,
                );
                if (!member.dynastyWith.length) delete member.dynastyWith;
              }
            }
            try {
              validate(next);
              if (await commit(next, "logDynasty")) {
                setDynastyPerson(null);
                setEditor(null);
                return "";
              }
              return t("dynastySaveFailed");
            } catch (e) {
              return String(e);
            }
          }}
        />
      )}
      {marriageUnion && family && (
        <MarriageDialog
          union={marriageUnion}
          busy={busy}
          onClose={() => !busy && setMarriageUnion(null)}
          onSave={async (marriage, marriedOn) => {
            const next = structuredClone(family),
              u = next.unions.find((u) => u.id === marriageUnion.id)!;
            u.marriage = marriage;
            if (marriage === "married") u.status = "active";
            if (marriage === "divorced") u.status = "separated";
            if (marriedOn) u.marriedOn = marriedOn;
            else delete u.marriedOn;
            assignMarriage(u);
            try {
              validate(next);
              if (await commit(next, "logMarriageChanged")) {
                setMarriageUnion(null);
                setEditor(null);
                return "";
              }
              return t("marriageSaveFailed");
            } catch (e) {
              return String(e);
            }
          }}
        />
      )}
      {guideOpen && (
        <Modal
          title={t("guideTitle")}
          onClose={() => setGuideOpen(false)}
          className="guide-modal"
          wide
        >
          <GuideBook chapter={guideChapter} onChapter={setGuideChapter} />
        </Modal>
      )}
      {settings && family && (
        <NameDialog
          name={family.name}
          busy={busy}
          askDescendants={preferences.askRemoveDescendants}
          removeDescendants={preferences.removeDescendants}
          showPartnerSlots={preferences.showPartnerSlots}
          language={preferences.language || "de"}
          onAskDescendants={(askRemoveDescendants) =>
            updatePreferences({ ...preferences, askRemoveDescendants })
          }
          onRemoveDescendants={(removeDescendants) =>
            updatePreferences({ ...preferences, removeDescendants })
          }
          onShowPartnerSlots={(showPartnerSlots) =>
            updatePreferences({ ...preferences, showPartnerSlots })
          }
          onLanguage={(language) =>
            updatePreferences({ ...preferences, language })
          }
          onClose={() => setSettings(false)}
          onSave={async (name) => {
            if (await commit({ ...family, name }, "logRenamed"))
              setSettings(false);
          }}
        />
      )}
      {history && (
        <Modal
          title={t("history")}
          onClose={() => !busy && setHistory(null)}
        >
          <p>
            {t("historyIntro")}
          </p>
          <div className="history-list">
            {history.map((r) => (
              <button
                disabled={busy}
                key={r.id}
                onClick={async () => {
                  if (
                    await ask(
                      t("restoreAsk"),
                    )
                  ) {
                    try {
                      if (
                        await commit(
                          await revision(r.id),
                          "logRevisionRestored",
                        )
                      ) {
                        setHistory(null);
                        setFocus(null);
                      }
                    } catch (e) {
                      setError(String(e));
                    }
                  }
                }}
              >
                <History size={16} />
                <span>
                  <strong>{text(r.label)}</strong>
                  <small>
                    {new Date(r.created).toLocaleString(
                      localeTag[preferences.language || "de"],
                    )}
                  </small>
                </span>
                <span>{t("open")}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            {t("historyHint")}
          </p>
        </Modal>
      )}
      {question && (
        <Modal
          title={question.title ?? t("confirmTitle")}
          onClose={() => {
            question.resolve(false);
            setQuestion(null);
          }}
        >
          <p>{question.text}</p>
          <div className="actions">
            <button
              onClick={() => {
                question.resolve(false);
                setQuestion(null);
              }}
            >
              {question.cancel ?? t("cancel")}
            </button>
            <button
              className={question.danger ? "danger" : "primary"}
              onClick={() => {
                question.resolve(true);
                setQuestion(null);
              }}
            >
              {question.confirm ?? t("confirm")}
            </button>
          </div>
        </Modal>
      )}
      {removePrompt && family && (
        <Modal
          title={t("descendantsTitle")}
          onClose={() => {
            removePrompt.resolve("cancel");
            setRemovePrompt(null);
          }}
        >
          <p>
            {t("descendantsBody", {
              name: displayName(
                family.members.find((p) => p.id === removePrompt.id),
              ),
              count: removePrompt.count,
              people: t(
                removePrompt.count === 1 ? "descendantOne" : "descendantMany",
              ),
            })}
          </p>
          <label className="choice-check">
            <input
              type="checkbox"
              checked={removePrompt.hide}
              onChange={(e) =>
                setRemovePrompt((current) =>
                  current ? { ...current, hide: e.target.checked } : current,
                )
              }
            />
            {t("dontAskAgain")}
          </label>
          <div className="actions">
            <button
              onClick={() => {
                removePrompt.resolve("cancel");
                setRemovePrompt(null);
              }}
            >
              {t("cancel")}
            </button>
            <button
              onClick={() => {
                if (removePrompt.hide)
                  updatePreferences({
                    ...preferences,
                    askRemoveDescendants: false,
                    removeDescendants: false,
                  });
                removePrompt.resolve("person");
                setRemovePrompt(null);
              }}
            >
              {t("onlyThisPerson")}
            </button>
            <button
              className="danger"
              onClick={() => {
                if (removePrompt.hide)
                  updatePreferences({
                    ...preferences,
                    askRemoveDescendants: false,
                    removeDescendants: true,
                  });
                removePrompt.resolve("tree");
                setRemovePrompt(null);
              }}
            >
              {t("removeWholeTree")}
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </>
  );
}
function PersonEditor({
  initial,
  family,
  busy,
  ask,
  onClose,
  onSave,
  onRemove,
  onSeparate,
  onMarriage,
  onDynasty,
  onJoinDynasty,
}: {
  initial: EditorState;
  family: Family;
  busy: boolean;
  ask: (
    s: string,
    labels?: {
      title?: string;
      confirm?: string;
      cancel?: string;
      danger?: boolean;
    },
  ) => Promise<boolean>;
  onClose: () => void;
  onSave: (p: Person, partner: string) => Promise<void>;
  onRemove: () => void;
  onSeparate: (u: Union) => void;
  onMarriage: (u: Union) => void;
  onDynasty: (id: string) => void;
  onJoinDynasty: (personId: string, founderId: string) => void;
}) {
  const [p, setP] = useState(initial.person),
    [editing, setEditing] = useState(initial.editing),
    [partner, setPartner] = useState(initial.partner),
    [cropFile, setCropFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const photoBusy = !!cropFile;
  const closing = useRef(false);
  const change = <K extends keyof Person>(key: K, value: Person[K]) => {
    setP((x) => ({ ...x, [key]: value }));
    setDirty(true);
  };
  const close = async () => {
    if (busy || photoBusy || closing.current) return;
    closing.current = true;
    try {
      if (
        !dirty ||
        (await ask(
          t("discardBody"),
          {
            title: t("discardTitle"),
            confirm: t("discard"),
            cancel: t("return"),
            danger: true,
          },
        ))
      )
        onClose();
    } finally {
      closing.current = false;
    }
  };
  const relations = family.unions.filter((u) => u.a === p.id || u.b === p.id);
  const livePerson = family.members.find((x) => x.id === p.id) ?? p;
  const names = nameInputs(p);
  const changeName = (key: "firstName" | "lastName", value: string) => {
    const next = { ...names, [key]: value };
    setP((x) => ({
      ...x,
      ...next,
      name: [next.firstName.trim(), next.lastName.trim()]
        .filter(Boolean)
        .join(" "),
    }));
    setDirty(true);
  };
  return (
    <Modal
      title={initial.fresh ? t("newMember") : t("memberProfile")}
      onClose={close}
      dismissOnBackdrop
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            validate(updatePerson(family, p, partner));
            await onSave(p, partner);
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        {initial.childForParent && (
          <p className="hint">
            {t("parentOf", {
              name: displayName(
                family.members.find(
                  (person) => person.id === initial.childForParent,
                ),
              ),
            })}
          </p>
        )}
        <div className="profile-heading">
          <Portrait p={p} />
          <div>
            <h2>{displayName(p) || t("aNewBranch")}</h2>
            <p>{years(p)}</p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)}>
              <Pencil size={16} /> {t("edit")}
            </button>
          )}
        </div>
        {editing && (
          <div className="photo-actions">
            <label className="file-button">
              <ImagePlus size={15} /> {t("choosePhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={photoBusy || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setError("");
                  if (
                    ![
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "image/avif",
                    ].includes(file.type) ||
                    file.size > imageByteLimit
                  ) {
                    setError(
                      t("errPhotoType"),
                    );
                    return;
                  }
                  setCropFile(file);
                }}
              />
            </label>
            {p.photo && (
              <button
                type="button"
                disabled={photoBusy || busy}
                onClick={() => change("photo", "")}
              >
                {t("removePhoto")}
              </button>
            )}
            <small>
              {photoBusy
                ? t("photoBusy")
                : t("photoHint")}
            </small>
          </div>
        )}
        <fieldset disabled={!editing || busy || photoBusy}>
          <div className="fields">
            <label>
              <span className="field-caption">
                {t("givenName")}
                {editing && <span className="required-mark">{t("required")}</span>}
              </span>
              <input
                required={editing}
                aria-required={editing}
                maxLength={100}
                placeholder={t("givenNamePlaceholder")}
                value={names.firstName}
                onChange={(e) => changeName("firstName", e.target.value)}
              />
            </label>
            <label>
              {t("surname")}
              <input
                maxLength={100}
                placeholder={t("surnamePlaceholder")}
                value={names.lastName}
                onChange={(e) => changeName("lastName", e.target.value)}
              />
            </label>
            <label>
              {t("birthName")}
              <input
                maxLength={100}
                placeholder={t("birthNamePlaceholder")}
                value={p.birthName || ""}
                onChange={(e) => change("birthName", e.target.value)}
              />
            </label>
            <label>
              {t("gender")}
              <select
                value={p.gender}
                onChange={(e) =>
                  change("gender", e.target.value as Person["gender"])
                }
              >
                <option value="" disabled>
                  {t("pleaseChoose")}
                </option>
                <option value="male">{t("male")}</option>
                <option value="female">{t("female")}</option>
              </select>
            </label>
            <div className="field-pair">
              <DateField
                label={t("birthDate")}
                value={p.born}
                example="14.03.1985"
                onChange={(value) => change("born", value)}
              />
              <DateField
                label={t("deathDateOptional")}
                value={p.died}
                example="21.09.2020"
                onChange={(value) => change("died", value)}
              />
            </div>
            <label>
              {t("birthPlace")}
              <input
                maxLength={200}
                value={p.place}
                onChange={(e) => change("place", e.target.value)}
              />
            </label>
            {[0, 1].map((i) => (
              <label key={i}>
                {t("parentSlot", { n: i + 1 })}
                <select
                  value={p.parents[i] || ""}
                  onChange={(e) => {
                    const parents = [...p.parents];
                    parents[i] = e.target.value;
                    change("parents", parents.filter(Boolean));
                  }}
                >
                  <option value="">{t("notSpecified")}</option>
                  {family.members
                    .filter((x) => x.id !== p.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {displayName(x)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <label>
              {t("currentPartner")}
              <select
                value={partner}
                onChange={(e) => {
                  setPartner(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="">{t("noPartnership")}</option>
                {family.members
                  .filter((x) => x.id !== p.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {displayName(x)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("story")}
              <textarea
                maxLength={5000}
                rows={4}
                value={p.bio}
                onChange={(e) => change("bio", e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          {editing && (
            <button className="primary" disabled={busy || photoBusy}>
              <Check size={16} /> {t("saveChanges")}
            </button>
          )}
          {!initial.fresh && (
            <button
              className="danger"
              type="button"
              disabled={busy || photoBusy}
              onClick={onRemove}
            >
              <Trash2 size={15} /> {t("remove")}
            </button>
          )}
        </div>
        {!initial.fresh && (
          <div className="relations">
            <h3>{t("dynastyTitle")}</h3>
            <button
              type="button"
              disabled={busy || dirty}
              onClick={() => onDynasty(p.id)}
            >
              {livePerson.dynasty
                ? t("dynastyOf", { name: livePerson.dynasty.name })
                : t("dynastyTitle")}
            </button>
          </div>
        )}
        {!initial.fresh && relations.length > 0 && (
          <div className="relations">
            <h3>{t("partnerships")}</h3>
            {relations.map((u) => {
              const other = family.members.find(
                (x) => x.id === (u.a === p.id ? u.b : u.a),
              );
              const joined = other
                ? livePerson.dynastyWith?.includes(other.id)
                : false;
              return (
              <div key={u.id}>
                <p>
                  {displayName(other)}
                  <small>
                    {u.status === "active"
                      ? t("together")
                      : u.marriage === "divorced"
                        ? t("divorced")
                        : t("separated")}{" "}
                    · {t("sharedChildren", { count: childrenOf(family, u).length })}
                    {u.ended ? t("childlessClosed") : ""}
                    {u.marriedOn
                      ? ` · ${t("marriedOnShort", { date: dateLabel(u.marriedOn) })}`
                      : ""}
                  </small>
                </p>
                {other?.dynasty && (
                  <button
                    type="button"
                    disabled={busy || dirty}
                    onClick={() => onJoinDynasty(p.id, other.id)}
                  >
                    {joined
                      ? t("leaveDynasty", { name: other.dynasty.name })
                      : t("joinDynasty", { name: other.dynasty.name })}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || dirty}
                  onClick={() => onMarriage(u)}
                >
                  {t("maritalStatus", {
                    status:
                      u.marriage === "married"
                        ? t("married")
                        : u.marriage === "divorced"
                          ? t("divorced")
                          : t("unspecified"),
                  })}
                </button>
                {u.status === "active" && (
                  <button
                    type="button"
                    disabled={busy || dirty}
                    onClick={() => onSeparate(u)}
                  >
                    {t("recordDivorce")}
                  </button>
                )}
              </div>
            );
            })}
          </div>
        )}
        <p className="hint">
          {editing
            ? t("editHint")
            : t("viewHint")}
        </p>
      </form>
      {cropFile && (
        <PhotoCrop
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(photo) => {
            change("photo", photo);
            setCropFile(null);
          }}
        />
      )}
    </Modal>
  );
}
function NameDialog({
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
              <option key={locale} value={locale}>
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
              onChange={(e) =>
                onRemoveDescendants(e.target.value === "tree")
              }
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
function Transfer({
  mode,
  family,
  ask,
  onClose,
  onImport,
  onNotice,
  onPdf,
}: {
  mode: "export" | "import";
  family: Family;
  ask: (s: string) => Promise<boolean>;
  onClose: () => void;
  onImport: (f: Family) => Promise<boolean>;
  onNotice: (s: string) => void;
  onPdf: () => void;
}) {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [kind, setKind] = useState<"choose" | "file">(
      mode === "export" ? "choose" : "file",
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
              onPdf();
              onClose();
            }}
          >
            <FileImage size={16} /> {t("exportAsPdf")}
          </button>
          <button type="button" onClick={() => setKind("file")}>
            <Download size={16} /> {t("exportAsUrinamu")}
          </button>
        </div>
        <p className="hint">{t("exportChooseHint")}</p>
      </Modal>
    );
  return (
    <Modal
      title={
        mode === "export" ? t("shareTitle") : t("openFileTitle")
      }
      onClose={() => !busy && onClose()}
    >
      <p>
        {mode === "export"
          ? t("shareBody")
          : t("openFileBody")}
      </p>
      {!desktop && (
        <p className="form-error">
          {t("desktopOnlyExchange")}
        </p>
      )}
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
      <p className="hint">
        {lines(t("cryptoHint"))}
      </p>
    </Modal>
  );
}

function DeathDialog({
  person,
  busy,
  onClose,
  onSave,
}: {
  person: Person;
  busy: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(person.died);
  const [error, setError] = useState("");
  const save = async (died: string) => {
    setError("");
    try {
      await onSave(died);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <Modal
      title={person.died ? t("changeDeath") : t("markDeceased")}
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
          void save(died);
        }}
      >
        <div className="fields">
          <DateField
            label={t("deathDate")}
            value={value}
            example="15.07.2020"
            required
            autoFocus
            disabled={busy}
            onChange={setValue}
          />
        </div>
        <p className="hint">
          {t("deathHint")}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy}>
            {t("saveDeath")}
          </button>
          {person.died && (
            <button type="button" disabled={busy} onClick={() => void save("")}>
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

function DynastyDialog({
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
          {logo && (
            <img className="dynasty-logo-preview" src={logo} alt="" />
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {shown(error)}
          </p>
        )}
        <div className="actions">
          <button className="primary" disabled={busy || reading || !name.trim()}>
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

function MarriageDialog({
  union,
  busy,
  onClose,
  onSave,
}: {
  union: Union;
  busy: boolean;
  onClose: () => void;
  onSave: (value: Marriage, marriedOn: string) => Promise<string>;
}) {
  const [value, setValue] = useState<Marriage>(
      union.status === "active" ? "married" : union.marriage || "unspecified",
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
              onChange={(e) => setValue(e.target.value as Marriage)}
            >
              {union.status !== "active" && (
                <option value="unspecified">{t("unspecified")}</option>
              )}
              <option value="married">{t("married")}</option>
              <option value="divorced">{t("divorced")}</option>
            </select>
          </label>
          <DateField
            label={t("weddingDateOptional")}
            value={marriedOn}
            example="18.06.1984"
            disabled={busy}
            onChange={setMarriedOn}
          />
        </div>
        <p className="hint">
          {t("marriageHint")}
        </p>
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

function lines(value: string) {
  return value.split("\n").map((line, index) => (
    <span key={index}>
      {index > 0 && <br />}
      {line}
    </span>
  ));
}

function LanguageScreen({
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
