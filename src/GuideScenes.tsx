import {
  ChevronUp,
  Columns3,
  Download,
  FileImage,
  FolderTree,
  GitMerge,
  History,
  Maximize,
  Minus,
  Check,
  ImagePlus,
  LockKeyhole,
  Pencil,
  Plus,
  Redo2,
  Search,
  Settings,
  Shrink,
  Sparkles,
  Trash2,
  TreePine,
  Undo2,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import demoFile from "./demo.json";
import crest from "./assets/guide-crest.png";
import DateField from "./DateField";
import Tree, { Portrait } from "./Tree";
import {
  displayName,
  nameInputs,
  newPerson,
  normalize,
  symbol,
  years,
  type Family,
  type Person,
} from "./domain";
import { tidyLayout, type Layout } from "./layout";
import { getLocale, localeTag, t } from "./i18n";

const idle = () => {};
const refuse = async () => false;

function guideFamily(ids: string[]): Family {
  const full = normalize(structuredClone(demoFile) as Family);
  return normalize({
    version: 2,
    name: full.name,
    members: full.members
      .filter((person) => ids.includes(person.id))
      .map((person) => ({
        ...person,
        parents: person.parents.filter((id) => ids.includes(id)),
        positions: undefined,
      })),
    unions: full.unions.filter(
      (union) => ids.includes(union.a) && ids.includes(union.b),
    ),
  });
}

const felix = guideFamily(["9"]);
const household = guideFamily(["3", "4", "7"]);
const wilhelm = guideFamily(["1"]);
const scattered: Family = structuredClone(household);
for (const person of scattered.members) {
  const spot =
    person.id === "3"
      ? { x: 20, y: 30 }
      : person.id === "4"
        ? { x: 460, y: 210 }
        : { x: 70, y: 460 };
  person.positions = { tapestry: spot };
}
const tidied = tidyLayout(structuredClone(household), "tapestry", false);
const divorced: Family = structuredClone(household);
for (const union of divorced.unions) {
  union.status = "separated";
  union.marriage = "divorced";
}
const dynasty = guideFamily(["3", "7", "5"]);
const founder = dynasty.members.find((person) => person.id === "3");
if (founder) {
  founder.dynasty = {
    name: "Morgenstern",
    corner: "left",
    logo: crest,
  };
}

export function GuideAddButton() {
  return (
    <button type="button" className="primary guide-replica" tabIndex={-1}>
      <Plus size={17} /> {t("addMember")}
    </button>
  );
}

export function GuideNav({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="guide-nav">
      <button type="button" className="nav" tabIndex={-1}>
        <Icon size={17} /> {label}
      </button>
    </div>
  );
}

export function GuideMembersNav() {
  return <GuideNav icon={Users} label={t("navMembers")} />;
}

export function GuideTreesNav() {
  return <GuideNav icon={FolderTree} label={t("myTrees")} />;
}

export function GuideMergeNav() {
  return <GuideNav icon={GitMerge} label={t("merge")} />;
}

export function GuideHistoryNav() {
  return <GuideNav icon={History} label={t("history")} />;
}

export function GuideSettingsNav() {
  return <GuideNav icon={Settings} label={t("settings")} />;
}

export function GuideCollapse() {
  return (
    <button type="button" className="head-toggle guide-replica" tabIndex={-1}>
      <ChevronUp size={15} /> {t("collapse")}
    </button>
  );
}

export function GuideSearch({ value = "" }: { value?: string } = {}) {
  return (
    <label className="search guide-replica">
      <Search size={17} />
      <input
        readOnly
        tabIndex={-1}
        value={value}
        placeholder={t("searchPlaceholder")}
        aria-hidden="true"
      />
    </label>
  );
}

export function GuideLayoutTabs() {
  const tabs = [
    [TreePine, "layoutClassic"],
    [Columns3, "layoutHorizontal"],
    [Sparkles, "layoutTapestry"],
  ] as const;
  return (
    <div className="tabs guide-replica">
      {tabs.map(([Icon, key], index) => (
        <button
          key={key}
          type="button"
          tabIndex={-1}
          className={index === 2 ? "active" : ""}
        >
          <Icon size={14} /> {t(key)}
        </button>
      ))}
    </div>
  );
}

export function GuideZoom() {
  return (
    <div className="zoom guide-zoom-replica" aria-hidden="true">
      <button type="button" tabIndex={-1} aria-label={t("zoomOut")}>
        <Minus size={16} />
      </button>
      <output>100%</output>
      <button type="button" tabIndex={-1} aria-label={t("zoomIn")}>
        <Plus size={16} />
      </button>
      <button type="button" tabIndex={-1} aria-label={t("fitAll")}>
        <Maximize size={16} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="guide-undo-target"
        aria-label={t("tidy")}
        title={t("tidy")}
      >
        <Shrink size={16} />
      </button>
    </div>
  );
}

export function GuideTransfer() {
  return (
    <div className="guide-undo" aria-hidden="true">
      <button type="button" tabIndex={-1}>
        <Upload size={15} /> {t("import")}
      </button>
      <button type="button" className="primary guide-undo-target" tabIndex={-1}>
        <Download size={15} /> {t("export")}
      </button>
    </div>
  );
}

export function GuideExportChoice() {
  return (
    <div className="guide-sheet" aria-hidden="true">
      <h3>{t("exportChooseTitle")}</h3>
      <p>{t("exportChooseBody")}</p>
      <div className="actions export-choices">
        <button type="button" className="primary" tabIndex={-1}>
          <FileImage size={16} /> {t("exportAsPdf")}
        </button>
        <button type="button" tabIndex={-1}>
          <Download size={16} /> {t("exportAsUrinamu")}
        </button>
      </div>
      <p className="hint">{t("exportChooseHint")}</p>
    </div>
  );
}

export function GuidePortrait() {
  return (
    <div className="guide-shots">
      <GuideTree family={felix} layout="tapestry" variant="card" />
      <GuideTree family={felix} layout="tapestry" variant="card drag" />
    </div>
  );
}

export function GuideFamily() {
  return <GuideTree family={household} layout="tapestry" variant="wide" />;
}

export function GuideMenu({
  family = felix,
  personId = "9",
}: {
  family?: Family;
  personId?: string;
} = {}) {
  const person =
    family.members.find((item) => item.id === personId) ?? family.members[0];
  const name = displayName(person);
  const locale = localeTag[getLocale()];
  const byLabel = (
    a: { label: string },
    b: { label: string },
  ) => a.label.localeCompare(b.label, locale);
  const active = family.unions.filter(
    (union) =>
      union.status === "active" &&
      (union.a === person.id || union.b === person.id),
  );
  const linked = family.unions.filter(
    (union) => union.a === person.id || union.b === person.id,
  );
  const otherOf = (union: (typeof linked)[number]) =>
    family.members.find(
      (item) => item.id === (union.a === person.id ? union.b : union.a),
    );
  const items = [
    { key: "child", group: "add" as const, plus: true, label: t("addChild") },
    {
      key: "partner",
      group: "add" as const,
      plus: true,
      disabled: active.length > 0,
      label: t("addNewPartner"),
    },
    {
      key: "ancestor",
      group: "add" as const,
      plus: true,
      disabled: person.parents.length >= 2,
      label:
        person.parents.length >= 2 ? t("parentsComplete") : t("addAncestors"),
    },
    ...linked.flatMap((union) => {
      const other = otherOf(union);
      if (!other) return [];
      return [
        {
          key: "child-" + union.id,
          group: "add" as const,
          plus: union.marriage !== "divorced",
          label: t("childWith", { name: displayName(other) }),
        },
      ];
    }),
    {
      key: "death",
      group: "other" as const,
      label: person.died ? t("changeDeathShort") : t("markDeceased"),
    },
    ...active.map((union) => ({
      key: "divorce-" + union.id,
      group: "other" as const,
      label: t("recordDivorce"),
    })),
    {
      key: "dynasty",
      group: "other" as const,
      label: person.dynasty
        ? t("editDynasty", { name: person.dynasty.name })
        : t("setDynasty", { name }),
    },
    ...linked.flatMap((union) => {
      const other = otherOf(union);
      if (!other?.dynasty) return [];
      const joined = person.dynastyWith?.includes(other.id);
      return [
        {
          key: "join-" + other.id,
          group: "other" as const,
          label: joined
            ? t("leaveDynasty", { name: other.dynasty.name })
            : t("joinDynasty", { name: other.dynasty.name }),
        },
      ];
    }),
    { key: "profile", group: "other" as const, label: t("openProfile") },
    {
      key: "remove",
      group: "other" as const,
      danger: true,
      label: t("removePerson"),
    },
  ];
  const ordered = [
    ...items.filter((item) => item.group === "add").sort(byLabel),
    ...items
      .filter((item) => item.group === "other" && item.key !== "remove")
      .sort(byLabel),
    ...items.filter((item) => item.key === "remove"),
  ];
  let otherStarted = false;
  return (
    <div className="person-context guide-context" aria-hidden="true">
      <div className="context-name">{name}</div>
      {ordered.map((item) => {
        const split =
          item.key === "remove" ||
          (item.group === "other" && !otherStarted);
        if (item.group === "other") otherStarted = true;
        return (
          <button
            key={item.key}
            type="button"
            tabIndex={-1}
            disabled={item.disabled}
            className={
              [item.danger ? "danger" : "", split ? "context-split" : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {item.plus && <Plus size={15} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function GuideMenuShot() {
  return (
    <div className="guide-shots">
      <GuideTree family={felix} layout="tapestry" variant="card" />
      <GuideMenu />
    </div>
  );
}

export function GuideUndo() {
  return (
    <div className="guide-undo" aria-hidden="true">
      <span className="guide-key">
        <button type="button" tabIndex={-1} className="guide-undo-target">
          <Undo2 size={16} />
        </button>
        {t("undo")}
      </span>
      <span className="guide-key">
        <button type="button" tabIndex={-1} disabled>
          <Redo2 size={16} />
        </button>
        {t("redo")}
      </span>
    </div>
  );
}

export function GuidePartner() {
  return (
    <div className="guide-partner">
      <GuideSettingsNav />
      <label className="choice-check guide-setting">
        <input type="checkbox" checked onChange={() => {}} tabIndex={-1} />
        {t("showPartnerSlots")}
      </label>
      <GuideTree
        family={felix}
        layout="tapestry"
        variant="slot"
        showPartnerSlots
      />
    </div>
  );
}

export function GuideLayouts() {
  const layouts = [
    ["classic", "layoutClassic"],
    ["horizontal", "layoutHorizontal"],
    ["tapestry", "layoutTapestry"],
  ] as const;
  return (
    <div className="guide-shots">
      {layouts.map(([layout, label]) => (
        <figure key={layout} className="guide-preview">
          <GuideTree family={household} layout={layout} variant="thumb" />
          <figcaption>{t(label)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function GuideTidy() {
  return (
    <div className="guide-shots">
      <figure className="guide-preview">
        <GuideTree family={scattered} layout="tapestry" variant="thumb" />
        <figcaption>{t("guidePreviewBefore")}</figcaption>
      </figure>
      <figure className="guide-preview">
        <GuideTree family={tidied} layout="tapestry" variant="thumb" />
        <figcaption>{t("guidePreviewAfter")}</figcaption>
      </figure>
    </div>
  );
}

export function GuideDynasty() {
  return <GuideTree family={dynasty} layout="tapestry" variant="wide" />;
}

export function GuideDeceased() {
  return <GuideTree family={wilhelm} layout="tapestry" variant="card" />;
}

export function GuideStillCard() {
  return <GuideTree family={felix} layout="tapestry" variant="card" />;
}

function GuidePersonForm({
  person,
  editing,
  fresh,
}: {
  person: Person;
  editing: boolean;
  fresh: boolean;
}) {
  const names = nameInputs(person);
  return (
    <div className="guide-sheet wide" aria-hidden="true">
      <h3>{fresh ? t("newMember") : t("memberProfile")}</h3>
      <div className="profile-heading">
        <Portrait p={person} />
        <div>
          <h2>{displayName(person) || t("aNewBranch")}</h2>
          <p>{years(person)}</p>
        </div>
        {!editing && (
          <button type="button" tabIndex={-1}>
            <Pencil size={16} /> {t("edit")}
          </button>
        )}
      </div>
      {editing && (
        <div className="photo-actions">
          <span className="file-button">
            <ImagePlus size={15} /> {t("choosePhoto")}
          </span>
          <small>{t("photoHint")}</small>
        </div>
      )}
      <fieldset disabled={!editing}>
        <div className="fields">
          <label>
            <span className="field-caption">
              {t("givenName")}
              {editing && (
                <span className="required-mark">{t("required")}</span>
              )}
            </span>
            <input
              readOnly
              tabIndex={-1}
              placeholder={t("givenNamePlaceholder")}
              value={names.firstName}
            />
          </label>
          <label>
            {t("surname")}
            <input
              readOnly
              tabIndex={-1}
              placeholder={t("surnamePlaceholder")}
              value={names.lastName}
            />
          </label>
          <label>
            {t("birthName")}
            <input
              readOnly
              tabIndex={-1}
              placeholder={t("birthNamePlaceholder")}
              value={person.birthName || ""}
            />
          </label>
          <label>
            {t("gender")}
            <select value={person.gender} disabled={!editing} tabIndex={-1}>
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
              value={person.born}
              example="14.03.1985"
              disabled={!editing}
              onChange={idle}
            />
            <DateField
              label={t("deathDateOptional")}
              value={person.died}
              example="21.09.2020"
              disabled={!editing}
              onChange={idle}
            />
          </div>
          <label>
            {t("birthPlace")}
            <input readOnly tabIndex={-1} value={person.place} />
          </label>
          {[0, 1].map((i) => (
            <label key={i}>
              {t("parentSlot", { n: i + 1 })}
              <select
                value={person.parents[i] || ""}
                disabled={!editing}
                tabIndex={-1}
              >
                <option value="">{t("notSpecified")}</option>
              </select>
            </label>
          ))}
          <label>
            {t("currentPartner")}
            <select value="" disabled={!editing} tabIndex={-1}>
              <option value="">{t("noPartnership")}</option>
            </select>
          </label>
          <label>
            {t("story")}
            <textarea readOnly tabIndex={-1} rows={4} value={person.bio} />
          </label>
        </div>
      </fieldset>
      <div className="actions">
        {editing && (
          <button type="button" className="primary" tabIndex={-1}>
            <Check size={16} /> {t("saveChanges")}
          </button>
        )}
        {!fresh && (
          <button type="button" className="danger" tabIndex={-1}>
            <Trash2 size={15} /> {t("remove")}
          </button>
        )}
      </div>
      {!fresh && (
        <div className="relations">
          <h3>{t("dynastyTitle")}</h3>
          <button type="button" tabIndex={-1}>
            {person.dynasty
              ? t("dynastyOf", { name: person.dynasty.name })
              : t("dynastyTitle")}
          </button>
        </div>
      )}
      <p className="hint">{editing ? t("editHint") : t("viewHint")}</p>
    </div>
  );
}

export function GuideNewMember() {
  return <GuidePersonForm person={newPerson()} editing fresh />;
}

export function GuideProfile() {
  return (
    <GuidePersonForm person={felix.members[0]} editing={false} fresh={false} />
  );
}

export function GuideMemberRow() {
  const person = felix.members[0];
  return (
    <div className="guide-sheet" aria-hidden="true">
      <button type="button" className="member-row" tabIndex={-1}>
        <Portrait p={person} />
        <span>
          <strong>
            {symbol(person)} {displayName(person)}
          </strong>
          <small>{years(person)}</small>
        </span>
        <Pencil size={14} />
      </button>
    </div>
  );
}

export function GuidePartnerMenu() {
  return (
    <div className="guide-shots">
      <GuideTree family={household} layout="tapestry" variant="wide" />
      <GuideMenu family={household} personId="3" />
    </div>
  );
}

export function GuideAncestors() {
  return (
    <div className="guide-ancestors" aria-hidden="true">
      <div className="guide-ancestor-row">
        <button type="button" className="partner-slot ancestor-slot" tabIndex={-1}>
          <Plus size={23} /> {t("addAncestor")}
        </button>
        <button type="button" className="partner-slot ancestor-slot" tabIndex={-1}>
          <Plus size={23} /> {t("addAncestor")}
        </button>
      </div>
      <GuideTree family={felix} layout="tapestry" variant="card" />
    </div>
  );
}

export function GuideDivorce() {
  return <GuideTree family={divorced} layout="tapestry" variant="wide" />;
}

export function GuideRemoveAsk() {
  const name = displayName(felix.members[0]);
  return (
    <div className="guide-shots">
      <div className="guide-sheet" aria-hidden="true">
        <h3>{t("confirmTitle")}</h3>
        <p>{t("removePersonAsk", { name })}</p>
        <div className="actions">
          <button type="button" tabIndex={-1}>
            {t("cancel")}
          </button>
          <button type="button" className="danger" tabIndex={-1}>
            {t("confirm")}
          </button>
        </div>
      </div>
      <div className="guide-sheet" aria-hidden="true">
        <h3>{t("descendantsTitle")}</h3>
        <p>
          {t("descendantsBody", {
            name: displayName(household.members.find((p) => p.id === "3")!),
            count: 1,
            people: t("descendantOne"),
          })}
        </p>
        <div className="actions">
          <button type="button" tabIndex={-1}>
            {t("onlyThisPerson")}
          </button>
          <button type="button" className="danger" tabIndex={-1}>
            {t("removeWholeTree")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuideSearchHit() {
  return (
    <div className="guide-shots">
      <GuideSearch value="Lena" />
      <GuideTree family={household} layout="tapestry" variant="wide" query="Lena" />
    </div>
  );
}

export function GuideDynastyForm() {
  const menuFamily = structuredClone(household);
  const thomas = menuFamily.members.find((person) => person.id === "3");
  if (thomas) {
    thomas.dynasty = { name: "Morgenstern", corner: "left", logo: crest };
  }
  return (
    <div className="guide-shots">
      <div className="guide-sheet" aria-hidden="true">
        <h3>{t("dynastyTitle")}</h3>
        <p>{t("dynastyBody")}</p>
        <div className="fields">
          <label>
            {t("dynastyName")}
            <input readOnly tabIndex={-1} value="Morgenstern" />
          </label>
          <div>
            <span className="field-caption">{t("dynastyCorner")}</span>
            <div className="dynasty-corner">
              <button type="button" aria-pressed="true" tabIndex={-1}>
                {t("dynastyLeft")}
              </button>
              <button type="button" aria-pressed="false" tabIndex={-1}>
                {t("dynastyRight")}
              </button>
            </div>
          </div>
          <label>
            {t("dynastyLogo")}
            <input type="file" tabIndex={-1} />
            <small className="field-hint">{t("photoHint")}</small>
          </label>
        </div>
        <div className="actions">
          <button type="button" className="primary" tabIndex={-1}>
            {t("dynastySave")}
          </button>
        </div>
      </div>
      <GuideMenu family={menuFamily} personId="4" />
    </div>
  );
}

export function GuideLibrary() {
  return (
    <div className="guide-sheet" aria-hidden="true">
      <h3>{t("myTrees")}</h3>
      <p>{t("libraryIntro")}</p>
      <div className="history-list">
      <div className="tree-row">
        <button type="button" tabIndex={-1}>
          <span>
            <strong>Familie Morgenstern</strong>
            <small>
              {t("membersOpen", { count: 3, suffix: t("openNow") })}
            </small>
          </span>
          <span>{t("current")}</span>
        </button>
        <button
          type="button"
          className="icon tree-rename-button"
          tabIndex={-1}
          aria-label={t("renameTree")}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="icon tree-delete"
          tabIndex={-1}
          aria-label={t("deleteTree")}
        >
          <Trash2 size={16} />
        </button>
      </div>
      </div>
      <label>
        {t("createTree")}
        <input readOnly tabIndex={-1} placeholder={t("treePlaceholder")} />
      </label>
      <div className="actions">
        <button type="button" className="primary" tabIndex={-1}>
          {t("createTreeButton")}
        </button>
      </div>
    </div>
  );
}

export function GuideMergePreview() {
  const thomas = household.members.find((person) => person.id === "3")!;
  const clara = household.members.find((person) => person.id === "4")!;
  const row = (person: typeof thomas) => (
    <div key={person.id}>
      <span>
        {displayName(person)}
        <small>{years(person)}</small>
      </span>
      <b>↔</b>
      <span>
        {displayName(person)}
        <small>{years(person)}</small>
      </span>
    </div>
  );
  return (
    <div className="match-preview guide-sheet" aria-hidden="true">
      <strong>{t("peopleMerged")}</strong>
      {row(thomas)}
      {row(clara)}
    </div>
  );
}

export function GuideHistoryList() {
  return (
    <div className="guide-shots">
      <div className="history-list guide-sheet" aria-hidden="true">
        <h3>{t("history")}</h3>
        <p>{t("historyIntro")}</p>
        <button type="button" tabIndex={-1}>
          <History size={16} />
          <span>
            <strong>{t("logMoved")}</strong>
            <small>27.10.2026, 09:00</small>
          </span>
          <span>{t("open")}</span>
        </button>
        <p className="hint">{t("historyHint")}</p>
      </div>
      <div className="guide-sheet" aria-hidden="true">
        <h3>{t("confirmTitle")}</h3>
        <p>{t("restoreAsk")}</p>
        <div className="actions">
          <button type="button" tabIndex={-1}>
            {t("cancel")}
          </button>
          <button type="button" className="primary" tabIndex={-1}>
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuideExportForm() {
  return (
    <div className="guide-sheet" aria-hidden="true">
      <h3>{t("shareTitle")}</h3>
      <p>{t("shareBody")}</p>
      <div className="fields">
        <label>
          {t("password")}
          <input readOnly tabIndex={-1} type="password" value="············" />
        </label>
        <label>
          {t("repeatPassword")}
          <input readOnly tabIndex={-1} type="password" value="············" />
        </label>
      </div>
      <p className="hint">{t("guideExportHint")}</p>
      <div className="actions">
        <button type="button" className="primary" tabIndex={-1}>
          <LockKeyhole size={16} /> {t("exportEncrypted")}
        </button>
      </div>
      <p className="hint guide-pre">{t("cryptoHint")}</p>
    </div>
  );
}

function GuideTree({
  family,
  layout,
  variant,
  showPartnerSlots = false,
  query = "",
}: {
  family: Family;
  layout: Layout;
  variant: string;
  showPartnerSlots?: boolean;
  query?: string;
}) {
  return (
    <div className={`guide-live ${variant}`} aria-hidden="true">
      <Tree
        preview
        family={family}
        layout={layout}
        query={query}
        focus={null}
        showPartnerSlots={showPartnerSlots}
        onFocus={idle}
        onMove={refuse}
        onMovePair={refuse}
        onTidy={idle}
        onEdit={idle}
        onPartner={idle}
        onBranch={idle}
        onAncestor={idle}
        onChild={idle}
        onSeparate={idle}
        onDeath={idle}
        onDynasty={idle}
        onJoinDynasty={idle}
        onRemove={idle}
      />
    </div>
  );
}
