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

/** Keep the guide available as soon as there is a tree to show. */
export function guideBeat(
  step: GuideStep,
  memberCount: number,
): GuideBeat | null {
  if (step >= 4) return null;
  if (memberCount === 0) return "empty";
  if (step <= 1) return "person";
  if (step === 2) return "menu";
  return "layouts";
}
