import { TreeToolbar } from "./TreeToolbar";
import { Logo } from "./Logo";
import { Modal } from "./Modal";
import { lines } from "./lines";
import PersonEditor from "./PersonEditor";
import NameDialog from "./NameDialog";
import Transfer from "./Transfer";
import DeathDialog from "./DeathDialog";
import DynastyDialog from "./DynastyDialog";
import MarriageDialog from "./MarriageDialog";
import LanguageScreen from "./LanguageScreen";
import MergeDialog from "./MergeDialog";
import LibraryDialog from "./LibraryDialog";
import { GuideBeatCard, GuideBook } from "./GuidePanel";
import { GuideSpotlight } from "./GuideSpotlight";
import { PdfJob } from "./PdfJob";
import { pdfFileName, savePdfFile } from "./savePdf";
import { nextGuideStep } from "./guide";
import { dateLabel } from "./dates";
import { lazy, Suspense } from "react";
import {
  Plus,
  Users,
  Network,
  Download,
  Upload,
  History,
  Undo2,
  Redo2,
  Pencil,
  X,
  Check,
  LockKeyhole,
  Settings,
  Leaf,
  GitMerge,
  FolderTree,
  BookOpen,
} from "lucide-react";
import {
  normalize,
  validate,
  assignMarriage,
  updatePerson,
  linkParent,
  childrenOf,
  symbol,
  years,
  displayName,
  matchesQuery,
  setDeathDate,
} from "./domain";
import { desktop, revision } from "./storage";
import Tree from "./Tree";
import { Portrait } from "./Portrait";
import { tidyLayout } from "./layout";
import demo from "./demo.json";
import { localeTag, shown, t, text } from "./i18n";
import { useAppController } from "./useAppController";

const PdfImport = lazy(() =>
  import("./PdfImport").then((module) => ({ default: module.PdfImport })),
);

export default function App() {
  const {
    canvasEpoch,
    family,
    loading,
    loadError,
    busy,
    error,
    setError,
    notice,
    setNotice,
    toolsOpen,
    setToolsOpen,
    layout,
    setLayout,
    focus,
    setFocus,
    query,
    setQuery,
    page,
    setPage,
    editor,
    setEditor,
    branch,
    setBranch,
    transfer,
    setTransfer,
    pdfFamily,
    setPdfFamily,
    pdfIncludeData,
    setPdfIncludeData,
    pdfImportOpen,
    setPdfImportOpen,
    pdfStep,
    setPdfStep,
    settings,
    setSettings,
    buildInfo,
    setBuildInfo,
    library,
    setLibrary,
    guideOpen,
    setGuideOpen,
    guideChapter,
    setGuideChapter,
    merging,
    setMerging,
    marriageUnion,
    setMarriageUnion,
    dynastyPerson,
    setDynastyPerson,
    deathPersonId,
    setDeathPersonId,
    history,
    setHistory,
    undo,
    redo,
    question,
    setQuestion,
    removePrompt,
    setRemovePrompt,
    preferences,
    ask,
    updatePreferences,
    settleGuide,
    beat,
    commit,
    toggleDynastyJoin,
    newTree,
    openTree,
    removeTree,
    renameTree,
    openPerson,
    addAncestor,
    add,
    requestRemove,
    confirmDeathChange,
    confirmParentPartnerships,
    separate,
    undoAction,
    showHistory,
  } = useAppController();
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
            {pdfFamily && pdfStep ? t("exportPdfBusy", pdfStep) : t("export")}
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {shown(error.message)}
          <button onClick={() => setError("")} aria-label={t("dismissError")}>
            <X size={16} />
          </button>
        </div>
      )}
      {!family ? (
        <div className="welcome">
          <div className="eyebrow">{t("welcomeEyebrow")}</div>
          <h1>{lines(t("welcomeTitle"))}</h1>
          <p>{lines(t("welcomeBody"))}</p>
          {loadError ? (
            <p>
              {t("welcomeLoadError")}
              <br />
              {shown(loadError)}
            </p>
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
                onClick={() => commit(normalize(demo), "logDemoLoaded")}
              >
                {t("exploreDemo")}
              </button>
            </div>
          )}
          <small>{desktop ? t("welcomeDesktop") : t("welcomeBrowser")}</small>
        </div>
      ) : (
        <div className="shell">
          {beat && <GuideSpotlight key={canvasEpoch} beat={beat} />}
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
            <TreeToolbar
              toolsOpen={toolsOpen}
              setToolsOpen={setToolsOpen}
              busy={busy}
              add={add}
              layout={layout}
              setLayout={setLayout}
              setPage={setPage}
              query={query}
              setQuery={setQuery}
            />
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
                onLink={async (childId, parentId) => {
                  try {
                    const next = linkParent(family, childId, parentId);
                    if (next !== family && (await confirmParentPartnerships(next)))
                      await commit(next, "logLinked");
                  } catch (e) {
                    setError(String(e));
                  }
                }}
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
                  beat === "person" || beat === "menu"
                    ? (family.members[0]?.id ?? null)
                    : null
                }
                guide={
                  beat && (
                    <GuideBeatCard
                      beat={beat}
                      layout={layout}
                      onNext={() => {
                        if (beat === "empty") add();
                        else settleGuide(nextGuideStep(preferences.guideStep));
                      }}
                      onSkip={() => settleGuide(4)}
                    />
                  )
                }
              />
            ) : (
              <div className="member-grid">
                {family.members.map((p) => (
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
                {!family.members.length && <p>{t("noMembersYet")}</p>}
              </div>
            )}
            <footer>
              <span>
                ✦ &nbsp; <span className="wordmark-uri">Uri</span>
                <span className="wordmark-namu">Namu</span> v{__APP_VERSION__} ·
                {t("footerMotto")}
              </span>
              <span>{desktop ? t("footerDesktop") : t("browserPreview")}</span>
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
                {new Intl.DateTimeFormat(
                  localeTag[preferences.language || "de"],
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZoneName: "short",
                  },
                ).format(new Date(__BUILD_TIME__))}
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
          onSave={async (p, next) => {
            try {
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
              if (!(await confirmParentPartnerships(next))) return;
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
              else throw Error(t("saveFailed"));
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
            onSave={async (died, deceased) => {
              const next = setDeathDate(family, deathPersonId, died, deceased);
              const person = family.members.find(
                (p) => p.id === deathPersonId,
              )!;
              if (person.died === died && Boolean(person.deceased) === deceased)
                return;
              const action =
                died || deceased
                  ? person.died || person.deceased
                    ? t("changeDeath")
                    : t("markDeceased")
                  : t("clearDeceased");
              if (
                !(await ask(
                  t("deathAsk", {
                    action,
                    name: displayName(person),
                    detail: died
                      ? t("deathDetailSet", { date: dateLabel(died) })
                      : deceased
                        ? t("deathDetailSet", { date: t("deathUnknown") })
                        : t("deathDetailClear"),
                  }),
                ))
              )
                return;
              if (
                await commit(
                  next,
                  died || deceased ? "logDeathSet" : "logDeathCleared",
                )
              )
                setDeathPersonId(null);
              else throw Error(t("deathSaveFailed"));
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
                  if (await commit(next, "logNoChildren")) setBranch(null);
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
                      branch.ended ? "logLineReopened" : "logLineClosed",
                    )
                  )
                    setBranch(null);
                }}
              >
                {branch.ended ? t("reopenLine") : t("closeLine")}
              </button>
            )}
          </div>
          <p className="hint">{t("lineHint")}</p>
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
          onPdf={(includeData) => {
            if (!family?.members.length) return;
            setPdfIncludeData(includeData);
            setPdfStep(null);
            setPdfFamily(structuredClone(family));
          }}
          onPdfImport={() => setPdfImportOpen(true)}
        />
      )}
      {pdfImportOpen && (
        <Suspense fallback={null}>
          <PdfImport
            onClose={() => setPdfImportOpen(false)}
            onCreate={(next) => {
              return newTree(next, "logImported", true);
            }}
          />
        </Suspense>
      )}
      {pdfFamily && (
        <PdfJob
          family={pdfFamily}
          layout={layout}
          includeData={pdfIncludeData}
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
            u.marriage = marriage === "separated" ? "unspecified" : marriage;
            if (marriage === "separated") u.status = "separated";
            if (marriage === "unspecified") u.status = "active";
            if (marriage === "married") u.status = "active";
            if (marriage === "divorced") u.status = "separated";
            if (
              marriedOn &&
              (marriage === "married" || marriage === "divorced")
            )
              u.marriedOn = marriedOn;
            else delete u.marriedOn;
            assignMarriage(u);
            try {
              validate(next);
              if (!(await confirmParentPartnerships(next))) return "";
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
        <Modal title={t("history")} onClose={() => !busy && setHistory(null)}>
          <p>{t("historyIntro")}</p>
          <div className="history-list">
            {history.map((r) => (
              <button
                disabled={busy}
                key={r.id}
                onClick={async () => {
                  if (await ask(t("restoreAsk"))) {
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
          <p className="hint">{t("historyHint")}</p>
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
