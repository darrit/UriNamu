import { useEffect, useMemo, useState } from "react";
import { type Family, type Union, years, displayName } from "./domain";
import { dateLabel } from "./dates";
import {
  mergeFamilies,
  eligibleUnions,
  coupleAlignment,
  matchedRelatives,
  profileConflicts,
  profileFieldLabel,
  type MergeOptions,
  type ProfileField,
} from "./merge";
import {
  listTrees,
  readTree,
  importFamily,
  desktop,
  type TreeInfo,
} from "./storage";
import { Modal } from "./App";
import { shown, t } from "./i18n";
const label = (f: Family, u: Union) =>
  `${displayName(f.members.find((p) => p.id === u.a))} & ${displayName(f.members.find((p) => p.id === u.b))} · ${u.marriage === "married" ? t("marriedShort") : t("divorcedShort")}`;
export default function MergeDialog({
  family,
  onClose,
  onMerged,
}: {
  family: Family;
  onClose: () => void;
  onMerged: (f: Family) => Promise<boolean>;
}) {
  const [trees, setTrees] = useState<TreeInfo[]>([]),
    [sourceId, setSourceId] = useState(""),
    [right, setRight] = useState<Family | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [options, setOptions] = useState<MergeOptions>({
    leftUnion: "",
    rightUnion: "",
    swap: false,
    name: `${family.name} · ${t("mergedSuffix")}`.slice(0, 100),
    marriage: "",
    parentPolicy: "combine",
    relationshipPolicy: "reject",
    matches: {},
    keepSeparate: [],
    fieldChoices: {},
  });
  useEffect(() => {
    listTrees()
      .then((t) => setTrees(t.filter((t) => !t.current)))
      .catch((e) => setError(String(e)));
  }, []);
  const update = <K extends keyof MergeOptions>(
    key: K,
    value: MergeOptions[K],
  ) => {
    setConfirmed(false);
    setOptions((o) => ({ ...o, [key]: value }));
  };
  const leftUnion = family.unions.find((u) => u.id === options.leftUnion),
    rightUnion = right?.unions.find((u) => u.id === options.rightUnion);
  const aligned =
    right && leftUnion && rightUnion
      ? coupleAlignment(family, right, leftUnion.id, rightUnion.id)
      : null;
  const swap = aligned ?? options.swap;
  const suggestions = useMemo(() => {
    if (!right || !options.leftUnion || !options.rightUnion) return {};
    try {
      return matchedRelatives(family, right, options);
    } catch {
      return {};
    }
  }, [family, right, options]);
  const conflicts = useMemo(() => {
    if (!right || !options.leftUnion || !options.rightUnion) return [];
    try {
      return profileConflicts(family, right, options);
    } catch {
      return [];
    }
  }, [family, right, options]);
  const conflictValue = (field: ProfileField, value: string) => {
    if (field === "photo") return "Vorhandenes Foto";
    if (field === "gender")
      return value === "male"
        ? t("maleWord")
        : value === "female"
          ? t("femaleWord")
          : value;
    if (field === "born" || field === "died") return dateLabel(value);
    return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  };
  const result = useMemo(() => {
    if (!right || !leftUnion || !rightUnion) return { family: null, error: "" };
    try {
      return { family: mergeFamilies(family, right, options), error: "" };
    } catch (e) {
      return {
        family: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [family, right, options, leftUnion, rightUnion]);
  return (
    <Modal
      title={t("mergeTitle")}
      wide
      onClose={() => !busy && onClose()}
    >
      <p>
        {t("mergeIntro")}
      </p>
      <div className="fields">
        <label>
          {t("secondTree")}
          <select
            value={sourceId}
            disabled={busy}
            onChange={(e) => {
              setSourceId(e.target.value);
              setRight(null);
              setConfirmed(false);
              setOptions((o) => ({ ...o, rightUnion: "", matches: {} }));
              setError("");
            }}
          >
            <option value="">{t("pleaseSelect")}</option>
            {trees.map((tree) => (
              <option key={tree.id} value={tree.id}>
                {t("memberOption", { name: tree.name, count: tree.members })}
              </option>
            ))}
            <option value="file" disabled={!desktop}>
              {t("openEncrypted")}
              {!desktop ? t("desktopOnly") : ""}
            </option>
          </select>
        </label>
        {sourceId === "file" && (
          <label>
            {t("filePassword")}
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
      </div>
      {!right && (
        <div className="actions">
          <button
            disabled={busy || !sourceId || (sourceId === "file" && !password)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const f =
                  sourceId === "file"
                    ? await importFamily(password)
                    : await readTree(sourceId);
                if (f) {
                  setRight(f);
                  setPassword("");
                }
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t("opening") : t("loadTree")}
          </button>
        </div>
      )}
      {right && (
        <>
          <div className="merge-summary">
            <span>
              {family.name}
              <strong>{t("memberCount", { count: family.members.length })}</strong>
            </span>
            <span>＋</span>
            <span>
              {right.name}
              <strong>{t("memberCount", { count: right.members.length })}</strong>
            </span>
          </div>
          {!eligibleUnions(family).length || !eligibleUnions(right).length ? (
            <p className="form-error">
              {t("coupleMissing")}
            </p>
          ) : (
            <>
              <div className="fields">
                <label>
                  {t("coupleCurrent")}
                  <select
                    value={options.leftUnion}
                    onChange={(e) => {
                      setConfirmed(false);
                      setOptions((o) => ({
                        ...o,
                        leftUnion: e.target.value,
                        matches: {},
                        keepSeparate: [],
                        fieldChoices: {},
                      }));
                    }}
                  >
                    <option value="">{t("chooseCouple")}</option>
                    {eligibleUnions(family).map((u) => (
                      <option key={u.id} value={u.id}>
                        {label(family, u)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("coupleSecond")}
                  <select
                    value={options.rightUnion}
                    onChange={(e) => {
                      setConfirmed(false);
                      setOptions((o) => ({
                        ...o,
                        rightUnion: e.target.value,
                        matches: {},
                        keepSeparate: [],
                        fieldChoices: {},
                      }));
                    }}
                  >
                    <option value="">{t("chooseCouple")}</option>
                    {eligibleUnions(right).map((u) => (
                      <option key={u.id} value={u.id}>
                        {label(right, u)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {leftUnion && rightUnion && (
                <>
                  <div className="match-preview">
                    <strong>{t("peopleMerged")}</strong>
                    {[0, 1].map((i) => {
                      const lid = i ? leftUnion.b : leftUnion.a,
                        rid = Boolean(i) !== swap ? rightUnion.b : rightUnion.a;
                      const l = family.members.find((p) => p.id === lid)!,
                        r = right.members.find((p) => p.id === rid)!;
                      return (
                        <div key={i}>
                          <span>
                            {displayName(l)}
                            <small>{years(l)}</small>
                          </span>
                          <b>↔</b>
                          <span>
                            {displayName(r)}
                            <small>{years(r)}</small>
                          </span>
                        </div>
                      );
                    })}
                    {aligned === null ? (
                      <button onClick={() => update("swap", !options.swap)}>
                        {t("swapPeople")}
                      </button>
                    ) : (
                      <p className="hint">
                        {t("recognizedByName")}
                      </p>
                    )}
                  </div>
                  <div className="fields">
                    <label>
                      {t("newTreeName")}
                      <input
                        maxLength={100}
                        value={options.name}
                        onChange={(e) => update("name", e.target.value)}
                      />
                    </label>
                    <label>
                      {t("resultCouple")}
                      <select
                        value={options.marriage}
                        onChange={(e) =>
                          update(
                            "marriage",
                            e.target.value as MergeOptions["marriage"],
                          )
                        }
                      >
                        <option value="" disabled>
                          {t("pleaseConfirm")}
                        </option>
                        <option value="married">{t("married")}</option>
                        <option value="divorced">{t("divorced")}</option>
                      </select>
                    </label>
                  </div>
                  {conflicts.length > 0 && (
                    <div className="fields">
                      <p className="hint">
                        {t("conflictHint")}
                      </p>
                      {conflicts.map((conflict) => {
                        const person = family.members.find(
                          (p) => p.id === conflict.leftId,
                        );
                        return (
                          <label
                            key={`${conflict.leftId}:${conflict.field}`}
                          >
                            {displayName(person)} ·{" "}
                            {profileFieldLabel(conflict.field)}
                            <select
                              aria-label={`${profileFieldLabel(conflict.field)} von ${displayName(person)}`}
                              value={
                                options.fieldChoices?.[conflict.leftId]?.[
                                  conflict.field
                                ] || ""
                              }
                              onChange={(e) => {
                                const side = e.target.value as
                                  | ""
                                  | "left"
                                  | "right";
                                setConfirmed(false);
                                setOptions((o) => ({
                                  ...o,
                                  fieldChoices: {
                                    ...o.fieldChoices,
                                    [conflict.leftId]: {
                                      ...o.fieldChoices?.[conflict.leftId],
                                      [conflict.field]: side || undefined,
                                    },
                                  },
                                }));
                              }}
                            >
                              <option value="">{t("pleaseDecide")}</option>
                              <option value="left">
                                {t("currentTreeValue", {
                                  value: conflictValue(
                                    conflict.field,
                                    conflict.leftValue,
                                  ),
                                })}
                              </option>
                              <option value="right">
                                {t("secondTreeValue", {
                                  value: conflictValue(
                                    conflict.field,
                                    conflict.rightValue,
                                  ),
                                })}
                              </option>
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <details className="merge-details">
                    <summary>{t("moreConflicts")}</summary>
                    <p>{t("moreConflictsBody")}</p>
                    <div className="fields">
                      {right.members
                        .filter(
                          (p) => p.id !== rightUnion.a && p.id !== rightUnion.b,
                        )
                        .map((p) => (
                          <label key={p.id}>
                            {displayName(p)} · {years(p)}
                            <select
                              aria-label={t("matchFor", { name: displayName(p) })}
                              value={
                                options.keepSeparate?.includes(p.id)
                                  ? ""
                                  : options.matches[p.id] ||
                                    suggestions[p.id] ||
                                    ""
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setConfirmed(false);
                                setOptions((o) => {
                                  const matches = { ...o.matches };
                                  const keepSeparate = (
                                    o.keepSeparate || []
                                  ).filter((id) => id !== p.id);
                                  if (value) matches[p.id] = value;
                                  else {
                                    delete matches[p.id];
                                    keepSeparate.push(p.id);
                                  }
                                  return { ...o, matches, keepSeparate };
                                });
                              }}
                            >
                              <option value="">
                                {t("keepExtra")}
                              </option>
                              {family.members
                                .filter(
                                  (q) =>
                                    q.id !== leftUnion.a &&
                                    q.id !== leftUnion.b,
                                )
                                .map((q) => (
                                  <option key={q.id} value={q.id}>
                                    {displayName(q)} · {years(q)}
                                  </option>
                                ))}
                            </select>
                          </label>
                        ))}
                      <label>
                        {t("parentMatches")}
                        <select
                          value={options.parentPolicy}
                          onChange={(e) =>
                            update(
                              "parentPolicy",
                              e.target.value as MergeOptions["parentPolicy"],
                            )
                          }
                        >
                          <option value="combine">
                            {t("combineParents")}
                          </option>
                          <option value="left">
                            {t("parentsFromCurrent")}
                          </option>
                          <option value="right">
                            {t("parentsFromSecond")}
                          </option>
                        </select>
                      </label>
                      <label>
                        {t("otherUnions")}
                        <select
                          value={options.relationshipPolicy}
                          onChange={(e) =>
                            update(
                              "relationshipPolicy",
                              e.target
                                .value as MergeOptions["relationshipPolicy"],
                            )
                          }
                        >
                          <option value="reject">
                            {t("stopAndShow")}
                          </option>
                          <option value="left">
                            {t("takeCurrent")}
                          </option>
                          <option value="right">
                            {t("takeSecond")}
                          </option>
                        </select>
                      </label>
                    </div>
                  </details>
                  {result.error && (
                    <p className="form-error" role="alert">
                      {shown(result.error)}
                    </p>
                  )}
                  {result.family && (
                    <div className="merge-result">
                      <strong>
                        {t("mergeResult", {
                          members: result.family.members.length,
                          unions: result.family.unions.length,
                        })}
                      </strong>
                      <label>
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />{" "}
                        {t("confirmSame")}
                      </label>
                      <button
                        className="primary"
                        disabled={!confirmed || busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            if (await onMerged(result.family!)) onClose();
                          } catch (e) {
                            setError(String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? t("saving") : t("createMerged")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {shown(error)}
        </p>
      )}
    </Modal>
  );
}
