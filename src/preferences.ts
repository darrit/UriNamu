import { type Locale } from "./i18n";
import { guideStepFromStorage, type GuideStep } from "./guide";

const key = "urinamu.preferences";

export type Preferences = {
  askRemoveDescendants: boolean;
  removeDescendants: boolean;
  showPartnerSlots: boolean;
  /** Absent until the first launch of this version asks for a choice. */
  language: Locale | null;
  /** 4 means the automatic hints stay quiet. */
  guideStep: GuideStep;
};

const languageOf = (value: unknown): Locale | null =>
  value === "de" || value === "en" || value === "ko" ? value : null;

export const defaultPreferences = (): Preferences => ({
  askRemoveDescendants: true,
  removeDescendants: false,
  showPartnerSlots: true,
  language: null,
  guideStep: 0,
});

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultPreferences();
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const language = languageOf(parsed.language);
    return {
      askRemoveDescendants: parsed.askRemoveDescendants !== false,
      removeDescendants: parsed.removeDescendants === true,
      showPartnerSlots: parsed.showPartnerSlots !== false,
      language,
      guideStep: guideStepFromStorage(parsed.guideStep, language !== null),
    };
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(preferences: Preferences) {
  localStorage.setItem(key, JSON.stringify(preferences));
}
