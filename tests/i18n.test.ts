import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, shown, t, text } from "../src/i18n";
import { years, type Person } from "../src/domain";

afterEach(() => setLocale("de"));

describe("Sprachen", () => {
  it("beginnt auf Deutsch und wechselt die Oberfläche sofort", () => {
    expect(getLocale()).toBe("de");
    expect(t("settings")).toBe("Einstellungen");
    expect(t("required")).toBe("Pflicht");
    setLocale("en");
    expect(t("settings")).toBe("Settings");
    expect(t("required")).toBe("Required");
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
  });

  it("lässt unbekannte Notizen stehen", () => {
    setLocale("ko");
    expect(text("Notiz von Arne")).toBe("Notiz von Arne");
  });

  it("folgt in Personenjahren der gewählten Sprache", () => {
    const person = {
      born: "",
      died: "",
    } as Person;
    expect(years(person)).toContain("Geburt offen");
    setLocale("en");
    expect(years(person)).toContain("Birth open");
    setLocale("ko");
    expect(years(person)).toContain("출생 미상");
  });
});
