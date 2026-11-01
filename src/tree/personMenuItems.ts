import { type Person, type Family, displayName } from "../domain";
import { t, getLocale, localeTag } from "../i18n";

export function personMenuItems({
  menu,
  menuPerson,
  family,
  setMenu,
  ancestorFor,
  onDeath,
  onPartner,
  onChild,
  onBranch,
  onSeparate,
  onDynasty,
  onJoinDynasty,
  onAncestors,
  onEdit,
  onRemove,
}: {
  menu: { id: string; x: number; y: number } | null;
  menuPerson: Person | undefined;
  family: Family;
  setMenu: (value: null) => void;
  ancestorFor: string | null;
  onDeath: (id: string) => void;
  onPartner: (id: string) => void;
  onChild: (id: string) => void;
  onBranch: (id: string) => void;
  onSeparate: (id: string) => void;
  onDynasty: (id: string) => void;
  onAncestors: (id: string) => void;
  onRemove: (id: string) => void;
  onJoinDynasty: (personId: string, founderId: string) => void;
  onEdit: (person: Person) => void;
}) {
  if (!menu || !menuPerson) return [];
  const close = (run: () => void) => {
    run();
    setMenu(null);
  };
  const active = family.unions.filter(
    (union) =>
      union.status === "active" &&
      (union.a === menuPerson.id || union.b === menuPerson.id),
  );
  const items = [
    {
      key: "death",
      group: "other" as const,
      label:
        menuPerson.died || menuPerson.deceased
          ? t("changeDeathShort")
          : t("markDeceased"),
      nested: false,
      onClick: () => close(() => onDeath(menuPerson.id)),
    },
    {
      key: "partner",
      group: "add" as const,
      plus: true,
      label: t("addNewPartner"),
      nested: false,
      disabled: active.length > 0,
      onClick: () => close(() => onPartner(menuPerson.id)),
    },
    {
      key: "single-child",
      group: "add" as const,
      plus: true,
      danger: false,
      disabled: false,
      label: t("addChild"),
      nested: false,
      onClick: () => close(() => onChild(menuPerson.id)),
    },
    ...family.unions
      .filter((union) => union.a === menuPerson.id || union.b === menuPerson.id)
      .map((union) => {
        const other = family.members.find(
          (person) =>
            person.id === (union.a === menuPerson.id ? union.b : union.a),
        );
        return {
          key: "child-" + union.id,
          group: "add" as const,
          plus: union.marriage !== "divorced",
          nested: union.marriage === "divorced",
          danger: false,
          disabled: false,
          label: t("childWith", { name: displayName(other) }),
          onClick: () => close(() => onBranch(union.id)),
        };
      }),
    ...active.map((union) => ({
      key: union.id,
      group: "other" as const,
      label: t(
        union.marriage === "married" ? "recordDivorce" : "recordSeparation",
      ),
      nested: false,
      onClick: () => close(() => onSeparate(union.id)),
    })),
    {
      key: "dynasty",
      group: "other" as const,
      label: menuPerson.dynasty
        ? t("editDynasty", { name: menuPerson.dynasty.name })
        : t("setDynasty", { name: displayName(menuPerson) }),
      nested: false,
      onClick: () => close(() => onDynasty(menuPerson.id)),
    },
    ...family.unions
      .filter((union) => union.a === menuPerson.id || union.b === menuPerson.id)
      .flatMap((union) => {
        const other = family.members.find(
          (person) =>
            person.id === (union.a === menuPerson.id ? union.b : union.a),
        );
        if (!other?.dynasty) return [];
        const joined = menuPerson.dynastyWith?.includes(other.id);
        return [
          {
            key: "join-" + other.id,
            group: "other" as const,
            label: joined
              ? t("leaveDynasty", { name: other.dynasty.name })
              : t("joinDynasty", { name: other.dynasty.name }),
            nested: false,
            onClick: () => close(() => onJoinDynasty(menuPerson.id, other.id)),
          },
        ];
      }),
    {
      key: "ancestor",
      group: "add" as const,
      plus: true,
      label:
        menuPerson.parents.length >= 2
          ? t("parentsComplete")
          : ancestorFor === menuPerson.id
            ? t("stopAncestors")
            : t("addAncestors"),
      nested: false,
      disabled: menuPerson.parents.length >= 2,
      onClick: () =>
        close(() => {
          onAncestors(menuPerson.id);
        }),
    },
    {
      key: "profile",
      group: "other" as const,
      label: t("openProfile"),
      nested: false,
      onClick: () => close(() => onEdit(menuPerson)),
    },
    {
      key: "remove",
      group: "other" as const,
      danger: true,
      label: t("removePerson"),
      nested: false,
      onClick: () => close(() => onRemove(menuPerson.id)),
    },
  ].sort((a, b) => {
    if (a.key === "remove") return 1;
    if (b.key === "remove") return -1;
    return a.group === b.group
      ? a.label.localeCompare(b.label, localeTag[getLocale()])
      : a.group === "add"
        ? -1
        : 1;
  });
  const nested = items.filter((item) => item.nested);
  const ordered = items.filter((item) => !item.nested);
  const childAt = ordered.findIndex((item) => item.key === "single-child");
  ordered.splice(
    childAt < 0 ? ordered.length : childAt + 1,
    0,
    ...nested.sort((a, b) =>
      a.label.localeCompare(b.label, localeTag[getLocale()]),
    ),
  );
  return ordered.map((item, index) => ({
    ...item,
    split:
      item.key === "remove" ||
      (item.group === "other" && ordered[index - 1]?.group === "add"),
  }));
}
