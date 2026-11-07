import { type EditorState } from "./PersonEditor";
import { type GuideChapter } from "./GuidePanel";
import { guideBeat, guideStepAfterFamily, type GuideStep } from "./guide";
import { dateLabel } from "./dates";
import { useEffect, useRef, useState } from "react";
import {
  type Family,
  type Person,
  type Union,
  newPerson,
  validate,
  removePerson,
  descendantIds,
  displayName,
  separatePartnership,
} from "./domain";
import {
  createTree,
  deleteTree,
  renameTree as saveTreeName,
  switchTree,
  loadFamily,
  saveFamily,
  revisions,
  type Revision,
} from "./storage";
import { type Layout, preserveLayout } from "./layout";
import {
  loadPreferences,
  savePreferences,
  type Preferences,
} from "./preferences";
import { setLocale, t, text } from "./i18n";

/** Owns application state and commands; App composes the interface. */
export function useAppController() {
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [family, setFamily] = useState<Family | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setErrorState] = useState<{ message: string } | null>(null),
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
    [pdfIncludeData, setPdfIncludeData] = useState(true),
    [pdfImportOpen, setPdfImportOpen] = useState(false),
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
  const setError = (message: string) => {
    setErrorState(message ? { message } : null);
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
      ? guideBeat(preferences.guideStep, family.members.length)
      : null;
  useEffect(() => {
    let mounted = true;
    loadFamily()
      .then((f) => {
        if (mounted) setFamily(f);
      })
      .catch((e) => {
        if (mounted) {
          const message = String(e);
          setLoadError(message);
          setErrorState({ message });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!error || loading || !preferences.language) return;
    const timer = setTimeout(() => {
      setErrorState((current) => current === error ? null : current);
    }, 5000);
    return () => clearTimeout(timer);
  }, [error, loading, preferences.language]);
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
  async function newTree(next: Family, label: string, propagateError = false) {
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
      if (propagateError) throw e;
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
      !(await ask(t("deleteTreeBody", { name: tree.name }), {
        title: t("deleteTreeTitle"),
        confirm: t("delete"),
        cancel: t("cancel"),
        danger: true,
      }))
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
    const married = u.marriage === "married" || u.marriage === "divorced";
    if (!family || !(await ask(t(married ? "divorceAsk" : "separationAsk"))))
      return;
    const next = separatePartnership(family, u.id);
    if (await commit(next, married ? "logDivorced" : "logSeparated"))
      setEditor(null);
  }
  async function undoAction(forward = false) {
    const source = forward ? redo : undo;
    if (!family || !source.length || busy) return;
    const previous = source[source.length - 1];
    if (await commit(previous, forward ? "logRedone" : "logUndone", false)) {
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
  return {
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
    separate,
    undoAction,
    showHistory,
  };
}
