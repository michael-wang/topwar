export const TANK_ALARM_PERIOD_SECONDS = .75;

// One slow visual swell per two-tone siren; both use elapsed Tank entrance time.
export function tankAlarmGlow(ageSeconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return .08;
  const phase = (ageSeconds % TANK_ALARM_PERIOD_SECONDS) / TANK_ALARM_PERIOD_SECONDS;
  return .04 + .10 * (.5 + .5 * Math.cos(phase * Math.PI * 2));
}
