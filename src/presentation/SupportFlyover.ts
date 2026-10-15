// Accepted straight flight, shared by visual positioning and the engine pass.
export const SUPPORT_BOMBER_ALTITUDE = 8.5;
export function supportFlightZ(age: number, firstImpactSeconds: number): number {
  return 11 + (age - firstImpactSeconds) * 18;
}
export function supportEngineEnvelope(age: number, firstImpactSeconds: number, duration: number): number {
  const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const distance = supportFlightZ(age, firstImpactSeconds);
  return smooth(age / 1.2) * smooth((duration - age) / 3) / (1 + (distance / 24) ** 2) ** .65;
}
