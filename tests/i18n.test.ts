import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocale, languagePrompt, setLocale, shown, t, text } from "../src/i18n";
import { years, type Person } from "../src/domain";
import { en } from "../src/locales/en";
import { ja } from "../src/locales/ja";
import { defaultPreferences, loadPreferences, savePreferences } from "../src/preferences";

afterEach(() => {
  setLocale("de");
  vi.unstubAllGlobals();
});

describe("Sprachen", () => {
  it("beginnt auf Deutsch und wechselt die Oberfläche sofort", () => {
    expect(getLocale()).toBe("de");
    expect(t("settings")).toBe("Einstellungen");
    expect(t("required")).toBe("Pflicht");
    setLocale("en");
    expect(t("settings")).toBe("Settings");
    expect(t("required")).toBe("Required");
    setLocale("ja");
    expect(t("settings")).toBe("設定");
    expect(t("navTree")).toBe("家系図");
    expect(languagePrompt("ja")).toBe("表示言語を選択してください");
    setLocale("ko");
    expect(t("settings")).toBe("설정");
    expect(t("required")).toBe("필수");
    expect(t("navTree")).toBe("가계도");
  });

  it("übersetzt gespeicherte Verlaufseinträge und Desktop-Fehler", () => {
    setLocale("en");
    expect(text("logMoved")).toBe("Person moved");
    expect(text("Person verschoben")).toBe("Person moved");
    expect(shown("Ungültige Familie.")).toBe("Invalid family.");
    expect(shown("Error: Stammbaum nicht gefunden.")).toBe("Family tree not found.");
    setLocale("ja");
    expect(text("Person verschoben")).toBe("人物を移動しました");
    expect(shown("Error: Stammbaum nicht gefunden.")).toBe("家系図が見つかりません。");
  });

  it("lässt unbekannte Notizen stehen", () => {
    setLocale("ko");
    expect(text("Anonyme Testnotiz")).toBe("Anonyme Testnotiz");
  });

  it("folgt in Personenjahren der gewählten Sprache", () => {
    const person = {
      born: "",
      died: "",
    } as Person;
    expect(years(person)).toContain("unbekannt");
    setLocale("en");
    expect(years(person)).toContain("unknown");
    setLocale("ko");
    expect(years(person)).toContain("미상");
  });

  it("behält Platzhalter in der japanischen Übersetzung bei", () => {
    const tokens = (message: string) => (message.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tokens(ja[key]), key).toEqual(tokens(en[key]));
    }
  });

  it("behält Japanisch nach dem Speichern und Neuladen der Einstellungen bei", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const preferences = {
      ...defaultPreferences(),
      language: "ja" as const,
      guideStep: 4 as const,
    };
    savePreferences(preferences);
    expect(loadPreferences()).toEqual(preferences);
  });
});
