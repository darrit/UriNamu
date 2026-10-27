export type GuideStep = 0 | 1 | 2 | 3 | 4;
export type GuideBeat = "empty" | "person" | "menu" | "layouts";

export function guideStepFromStorage(
  value: unknown,
  languageChosen: boolean,
): GuideStep {
  if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4)
    return value;
  return languageChosen ? 4 : 0;
}

/** An empty-tree hint has nothing left to say once a person exists. */
export function guideStepAfterFamily(
  step: GuideStep,
  memberCount: number,
): GuideStep {
  if (step === 0 && memberCount > 0) return 1;
  return step;
}

export function nextGuideStep(step: GuideStep): GuideStep {
  if (step >= 3) return 4;
  return (step + 1) as GuideStep;
}

/** Automatic hints. Step 4 and a missing trigger stay quiet. */
export function guideBeat(
  step: GuideStep,
  memberCount: number,
  unionCount: number,
): GuideBeat | null {
  if (step >= 4) return null;
  if (step <= 0) return memberCount === 0 ? "empty" : null;
  if (step === 1) return memberCount >= 1 ? "person" : null;
  if (step === 2) return memberCount >= 1 ? "menu" : null;
  return memberCount >= 3 || unionCount >= 1 ? "layouts" : null;
}
