import { de } from "./locales/de";
import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import type { Catalog, MessageKey } from "./locales/types";
export type { MessageKey } from "./locales/types";

export const locales = ["de", "en", "ja", "ko"] as const;
export type Locale = (typeof locales)[number];

export const localeTag: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
  ja: "ja-JP",
  ko: "ko-KR",
};

/** English shows times with am/pm; the other languages use their locale's own convention. */
export function timeOptions(locale: Locale): Intl.DateTimeFormatOptions {
  return locale === "en" ? { hour12: true } : {};
}

export const languageName: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

const catalogs: Record<Locale, Catalog> = { de, en, ja, ko };
let current: Locale = "de";

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale) {
  current = locale;
}

export function languagePrompt(locale: Locale) {
  return catalogs[locale].languagePrompt;
}

export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let value: string = catalogs[current][key] ?? de[key];
  if (vars)
    for (const [name, replacement] of Object.entries(vars))
      value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

/** Show a stored history label in the active language. Unknown notes stay as written. */
export function text(value: string): string {
  if (value in de) return t(value as MessageKey);
  return shown(value);
}

const known = new Map<string, MessageKey>();
for (const catalog of Object.values(catalogs))
  for (const key of Object.keys(de) as MessageKey[])
    if (!known.has(catalog[key])) known.set(catalog[key], key);

/** Translate a message thrown in any supported language, including desktop errors. */
export function shown(value: string): string {
  const message = value.replace(/^Error:\s*/, "");
  const key = known.get(message);
  return key ? t(key) : message;
}
