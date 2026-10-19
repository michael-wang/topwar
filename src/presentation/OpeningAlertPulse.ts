/** Shared presentation phase; callers freeze seconds during Pause/background. */
export function openingAlertPulse(seconds: number): number {
  return seconds < 1.2 ? Math.sin(Math.PI * Math.max(0, seconds) / 1.2)
    : (1 - Math.cos(2 * Math.PI * (seconds - 1.2) / 2.6)) / 2;
}
export function openingSirenGain(seconds: number): number {
  return .045 + .035 * openingAlertPulse(seconds);
}
export function openingSirenFrequency(seconds: number): number {
  return 180 + 240 * openingAlertPulse(seconds);
}
export function openingAlertOpacity(seconds: number, reduced: boolean): number {
  return reduced ? .8 : .28 + .62 * openingAlertPulse(seconds);
}
