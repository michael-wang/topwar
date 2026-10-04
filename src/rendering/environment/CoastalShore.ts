// Visual offsets never move simulation rows; ART owns the shared visual anchor.
export const COASTAL_SHORE = {
  spatialAmplitude: .85,
  secondaryAmplitude: .25,
  tideAmplitude: .4,
  tidePeriodSeconds: 12,
  wetWidth: 3.8,
  beachReach: 7,
  seaReach: 8,
} as const;

export const COASTAL_SURF = {
  cycleSeconds: 6.4,
  frontCount: 2,
  startOffset: 2.25,
  endOffset: -.25,
  minimumWidth: .40,
  peakWidth: .80,
  peakFoam: .90,
} as const;

const smooth = (a: number, b: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Analytic QA sample of the shader fronts; no CPU geometry animation or timers.
export function travellingSurfFront(x: number, nowMs: number, front: 0 | 1) {
  const clock = nowMs / 1000 / COASTAL_SURF.cycleSeconds + front / COASTAL_SURF.frontCount
    + .032 * Math.sin(x * .11) + .014 * Math.sin(x * .39 + 1.2);
  const phase = clock - Math.floor(clock), travel = smooth(0, .72, phase);
  return {
    phase,
    center: COASTAL_SURF.startOffset + (COASTAL_SURF.endOffset - COASTAL_SURF.startOffset) * travel,
    width: COASTAL_SURF.minimumWidth + (COASTAL_SURF.peakWidth - COASTAL_SURF.minimumWidth) * travel,
    envelope: smooth(.015, .09, phase) * (1 - smooth(.68, .90, phase)),
  };
}

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
  #ifdef SHORE_OVERLAY
  float surfFront(float phase,float edge,float broken){
    float travel=smoothstep(0.,.72,phase);
    float crest=mix(${COASTAL_SURF.startOffset.toFixed(2)},${COASTAL_SURF.endOffset.toFixed(2)},travel);
    float width=mix(${COASTAL_SURF.minimumWidth.toFixed(2)},${COASTAL_SURF.peakWidth.toFixed(2)},travel)*(.8+.2*broken);
    float envelope=smoothstep(.015,.09,phase)*(1.-smoothstep(.68,.90,phase));
    return (1.-smoothstep(width*.30,width*.5,abs(edge-crest)))
      *broken*envelope*mix(.7,1.,travel)*${COASTAL_SURF.peakFoam.toFixed(2)};
  }
  #endif
`;
