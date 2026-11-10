import { useState } from "react";
import { Modal } from "./Modal";
import { t, shown } from "./i18n";
import { useRef } from "react";
import { Pencil, ImagePlus, Check, Trash2 } from "lucide-react";
import {
  type Person,
  type Family,
  type Union,
  type NewPartnership,
  nameInputs,
  updatePerson,
  displayName,
  years,
  childrenOf,
} from "./domain";
import { Portrait } from "./Portrait";
import PhotoCrop from "./PhotoCrop";
import DateField from "./DateField";
import FilePick from "./FilePick";
import { dateLabel } from "./dates";
import { imageByteLimit } from "./storage";

export interface EditorState {
  person: Person;
  editing: boolean;
  partner: string;
  fresh: boolean;
  childForParent?: string;
}

export default function PersonEditor({
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
  onSave: (p: Person, next: Family) => Promise<void>;
  onRemove: () => void;
  onSeparate: (u: Union) => void;
  onMarriage: (u: Union) => void;
  onDynasty: (id: string) => void;
  onJoinDynasty: (personId: string, founderId: string) => void;
}) {
  const [p, setP] = useState(initial.person),
    [editing, setEditing] = useState(initial.editing),
    [partner, setPartner] = useState(initial.partner),
    [marriage, setMarriage] = useState<NewPartnership["marriage"]>("unspecified"),
    [marriedOn, setMarriedOn] = useState(""),
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
        (await ask(t("discardBody"), {
          title: t("discardTitle"),
          confirm: t("discard"),
          cancel: t("return"),
          danger: true,
        }))
      )
        onClose();
    } finally {
      closing.current = false;
    }
  };
  const relations = family.unions.filter((u) => u.a === p.id || u.b === p.id);
  const showPartnership =
    !!partner && !relations.some((u) => u.a === partner || u.b === partner);
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
            const next = updatePerson(
              family,
              p,
              partner,
              showPartnership ? { marriage, marriedOn } : undefined,
            );
            await onSave(p, next);
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
            <FilePick
                className="file-button"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={photoBusy || busy}
                onFile={(file) => {
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
                    setError(t("errPhotoType"));
                    return;
                  }
                  setCropFile(file);
                }}
              >
                <ImagePlus size={15} /> {t("choosePhoto")}
              </FilePick>
            {p.photo && (
              <button
                type="button"
                disabled={photoBusy || busy}
                onClick={() => change("photo", "")}
              >
                {t("removePhoto")}
              </button>
            )}
            <small>{photoBusy ? t("photoBusy") : t("photoHint")}</small>
          </div>
        )}
        <fieldset disabled={!editing || busy || photoBusy}>
          <div className="fields">
            <label>
              <span className="field-caption">
                {t("givenName")}
                {editing && (
                  <span className="required-mark">{t("required")}</span>
                )}
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
              {t("marriageNames")}
              <input
                maxLength={200}
                placeholder={t("marriageNamesPlaceholder")}
                value={(p.marriageNames ?? []).join(" / ")}
                onChange={(e) => {
                  const parts = e.target.value
                    .split("/")
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .slice(0, 6);
                  change("marriageNames", parts.length ? parts : undefined);
                }}
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
                example="1985-03-14"
                onChange={(value) => change("born", value)}
              />
              <DateField
                label={t("deathDateOptional")}
                value={p.died}
                example="2020-09-21"
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
                  setMarriage("unspecified");
                  setMarriedOn("");
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
            {showPartnership && (
              <div className="field-pair">
                <label>
                  {t("maritalLabel")}
                  <select
                    value={marriage}
                    onChange={(e) => {
                      setMarriage(e.target.value as NewPartnership["marriage"]);
                      setDirty(true);
                    }}
                  >
                    <option value="unspecified">{t("unspecified")}</option>
                    <option value="married">{t("married")}</option>
                  </select>
                </label>
                {marriage === "married" && (
                  <DateField
                    label={t("weddingDateOptional")}
                    value={marriedOn}
                    example="1984-06-18"
                    onChange={(value) => {
                      setMarriedOn(value);
                      setDirty(true);
                    }}
                  />
                )}
              </div>
            )}
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
                      ·{" "}
                      {t("sharedChildren", {
                        count: childrenOf(family, u).length,
                      })}
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
                      {t(
                        u.marriage === "married"
                          ? "recordDivorce"
                          : "recordSeparation",
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="hint">{editing ? t("editHint") : t("viewHint")}</p>
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
