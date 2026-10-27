import { describe, expect, it } from "vitest";
import {
  guideBeat,
  guideStepAfterFamily,
  guideStepFromStorage,
  nextGuideStep,
} from "../src/guide";

describe("Leitfaden", () => {
  it("lässt bestehende Sprachen in Ruhe und beginnt bei einer neuen Wahl bei null", () => {
    expect(guideStepFromStorage(undefined, true)).toBe(4);
    expect(guideStepFromStorage(undefined, false)).toBe(0);
    expect(guideStepFromStorage(2, true)).toBe(2);
    expect(guideStepFromStorage(5, false)).toBe(0);
  });

  it("überspringt den leeren Hinweis, sobald eine Person da ist", () => {
    expect(guideStepAfterFamily(0, 0)).toBe(0);
    expect(guideStepAfterFamily(0, 1)).toBe(1);
    expect(guideStepAfterFamily(2, 4)).toBe(2);
    expect(guideStepAfterFamily(4, 0)).toBe(4);
  });

  it("zeigt jeden Takt nur, wenn sein Auslöser da ist", () => {
    expect(guideBeat(0, 0, 0)).toBe("empty");
    expect(guideBeat(0, 2, 0)).toBeNull();
    expect(guideBeat(1, 1, 0)).toBe("person");
    expect(guideBeat(2, 1, 0)).toBe("menu");
    expect(guideBeat(3, 2, 0)).toBeNull();
    expect(guideBeat(3, 2, 1)).toBe("layouts");
    expect(guideBeat(3, 3, 0)).toBe("layouts");
    expect(guideBeat(4, 8, 3)).toBeNull();
  });

  it("schließt die Reihe nach dem letzten Takt", () => {
    expect(nextGuideStep(0)).toBe(1);
    expect(nextGuideStep(3)).toBe(4);
    expect(nextGuideStep(4)).toBe(4);
  });
});
