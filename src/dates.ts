export function dateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}
export function dateValue(value: string): string {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
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
