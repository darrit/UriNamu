import { type Locale } from "./i18n";

const key = "urinamu.preferences";

export type Preferences = {
  askRemoveDescendants: boolean;
  removeDescendants: boolean;
  showPartnerSlots: boolean;
  /** Absent until the first launch of this version asks for a choice. */
  language: Locale | null;
};

const languageOf = (value: unknown): Locale | null =>
  value === "de" || value === "en" || value === "ko" ? value : null;

export const defaultPreferences = (): Preferences => ({
  askRemoveDescendants: true,
  removeDescendants: false,
  showPartnerSlots: true,
  language: null,
});

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultPreferences();
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      askRemoveDescendants: parsed.askRemoveDescendants !== false,
      removeDescendants: parsed.removeDescendants === true,
      showPartnerSlots: parsed.showPartnerSlots !== false,
      language: languageOf(parsed.language),
    };
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(preferences: Preferences) {
  localStorage.setItem(key, JSON.stringify(preferences));
}
