export const LOCK_ON_ALERT_MS = 450;
export const LOCK_ON_AUDIO_GAP_SECONDS = .35;
// Area, rather than radius, represents elapsed flight: the unfilled center shrinks inward.
export function warningInnerRadius(progress: number): number {
  return Math.sqrt(1 - Math.max(0, Math.min(1, progress)));
}
