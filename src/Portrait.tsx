import { type Person, displayName } from "./domain";
import { dateLabel } from "./dates";
import { t } from "./i18n";

export function Portrait({ p }: { p: Person }) {
  return (
    <span
      className={`portrait${p.died || p.deceased ? " portrait--deceased" : ""}`}
      title={p.died ? t("diedOn", { date: dateLabel(p.died) }) : undefined}
    >
      {p.photo ? (
        <img
          src={p.photo}
          alt={`${displayName(p)}${p.died ? ` – ${t("diedOn", { date: dateLabel(p.died) })}` : ""}`}
          draggable={false}
        />
      ) : (
        <span className="portrait-initials">
          {p.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
      )}
    </span>
  );
}
