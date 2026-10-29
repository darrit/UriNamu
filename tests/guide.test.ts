import { describe, expect, it } from "vitest";
import {
  guideBeat,
  guideStepAfterFamily,
  guideStepFromStorage,
  nextGuideStep,
} from "../src/guide";

describe("Guide", () => {
  it("leaves an existing language alone and starts a new choice at zero", () => {
    expect(guideStepFromStorage(undefined, true)).toBe(4);
    expect(guideStepFromStorage(undefined, false)).toBe(0);
    expect(guideStepFromStorage(2, true)).toBe(2);
    expect(guideStepFromStorage(5, false)).toBe(0);
  });

  it("skips the empty hint once a person is present", () => {
    expect(guideStepAfterFamily(0, 0)).toBe(0);
    expect(guideStepAfterFamily(0, 1)).toBe(1);
    expect(guideStepAfterFamily(2, 4)).toBe(2);
    expect(guideStepAfterFamily(4, 0)).toBe(4);
  });

  it("shows each beat only when its trigger is present", () => {
    expect(guideBeat(0, 0, 0)).toBe("empty");
    expect(guideBeat(0, 2, 0)).toBeNull();
    expect(guideBeat(1, 1, 0)).toBe("person");
    expect(guideBeat(2, 1, 0)).toBe("menu");
    expect(guideBeat(3, 2, 0)).toBeNull();
    expect(guideBeat(3, 2, 1)).toBe("layouts");
    expect(guideBeat(3, 3, 0)).toBe("layouts");
    expect(guideBeat(4, 8, 3)).toBeNull();
  });

  it("stops the sequence after the last beat", () => {
    expect(nextGuideStep(0)).toBe(1);
    expect(nextGuideStep(3)).toBe(4);
    expect(nextGuideStep(4)).toBe(4);
  });
});
