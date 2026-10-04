// Presentation bounds only. Simulation continues to use ART's canonical Z=53.
export const COASTAL_SHORE = {
  spatialAmplitude: .85,
  secondaryAmplitude: .25,
  tideAmplitude: .4,
  tidePeriodSeconds: 12,
  wetWidth: 3.8,
  beachReach: 7,
  seaReach: 8,
} as const;

// Also used by visual QA to sample safe coverage and deterministic rewind.
export function visualShoreOffset(x: number, nowMs: number): number {
  return COASTAL_SHORE.spatialAmplitude * Math.sin(x * .115 + .45)
    + COASTAL_SHORE.secondaryAmplitude * Math.sin(x * .293 + 1.7)
    + COASTAL_SHORE.tideAmplitude * Math.sin(nowMs / 1000 * Math.PI * 2 / COASTAL_SHORE.tidePeriodSeconds + .25 * Math.sin(x * .14));
}

export const COASTAL_SHORE_GLSL = `
  float shoreOffset(float x){
    return ${COASTAL_SHORE.spatialAmplitude}*sin(x*.115+.45)
      +${COASTAL_SHORE.secondaryAmplitude}*sin(x*.293+1.7)
      +${COASTAL_SHORE.tideAmplitude}*sin(time*${Math.PI * 2 / COASTAL_SHORE.tidePeriodSeconds}+.25*sin(x*.14));
  }
`;
