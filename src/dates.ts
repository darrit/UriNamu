import { getLocale, type Locale } from "./i18n";

/** How a calendar date is written and typed in each language. Dates are always stored as ISO (YYYY-MM-DD). */
const layouts: Record<Locale, { order: "dmy" | "mdy" | "ymd"; separator: string }> = {
  de: { order: "dmy", separator: "." },
  en: { order: "mdy", separator: "/" },
  ja: { order: "ymd", separator: "/" },
  ko: { order: "ymd", separator: "." },
};

export function dateLabel(value: string, locale: Locale = getLocale()): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  const { order, separator } = layouts[locale];
  return (order === "dmy" ? [day, month, year] : order === "mdy" ? [month, day, year] : [year, month, day]).join(separator);
}

/** Convert typed text to ISO. Year-first input works in every language; otherwise the active language decides day/month order. */
export function dateValue(value: string, locale: Locale = getLocale()): string {
  const text = value.trim();
  const sep = "\\s*[./-]\\s*";
  const yearFirst = text.match(new RegExp(`^(\\d{4})${sep}(\\d{2})${sep}(\\d{2})\\.?$`));
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2]}-${yearFirst[3]}`;
  const yearLast = text.match(new RegExp(`^(\\d{2})${sep}(\\d{2})${sep}(\\d{4})\\.?$`));
  if (!yearLast) return text;
  const [, first, second, year] = yearLast;
  return layouts[locale].order === "mdy" ? `${year}-${first}-${second}` : `${year}-${second}-${first}`;
}

/** HTML pattern for a typed full date in the active language. */
export function datePattern(locale: Locale = getLocale()): string {
  const sep = "(?:\\.|/|-)";
  return layouts[locale].order === "ymd"
    ? `[0-9]{4}${sep}[0-9]{2}${sep}[0-9]{2}`
    : `[0-9]{2}${sep}[0-9]{2}${sep}[0-9]{4}`;
}

export function validDate(value: string): boolean {
  if (/^\d{4}$/.test(value)) return value !== "0000";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dateBounds(value: string): [string, string] {
  return /^\d{4}$/.test(value) ? [`${value}-01-01`, `${value}-12-31`] : [value, value];
}

/** Compare only when even the possible date ranges do not overlap. */
export function definitelyBefore(a: string, b: string): boolean {
  return !!a && !!b && dateBounds(a)[1] < dateBounds(b)[0];
}
