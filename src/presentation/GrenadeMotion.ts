// Deterministic presentation only; never applied to authoritative positions.
export const GRENADE_FX = { durationMs: 1200, slots: 2, airborneLimit: 8, airborneMs: 1150, reactionMs: 650 } as const;
export function radialBlastDirection(x: number, z: number, centerX: number, centerZ: number, id: number) {
  const dx = centerX - x, dz = z - centerZ, length = Math.hypot(dx, dz);
  const angle = id * 2.399963229728653;
  return length > .001 ? { x: dx / length, z: dz / length } : { x: Math.cos(angle), z: Math.sin(angle) };
}
export function airborneGrenadePose(ageMs: number) {
  const t = Math.max(0, ageMs / 1000), landed = Math.min(t, .88);
  return { distance: landed * 2.7, lift: Math.max(0, 5.28 * landed - 6 * landed * landed),
    angle: Math.min(1, t / .88) * 1.45, opacity: Math.max(0, 1 - Math.max(0, t - .88) / .27),
    visible: ageMs >= 0 && ageMs < GRENADE_FX.airborneMs };
}
export function survivingBlastStrength(ageMs: number) {
  const t = Math.max(0, Math.min(1, ageMs / GRENADE_FX.reactionMs));
  return Math.sin(Math.PI * Math.min(1, t / .22) / 2) * (1 - t) ** 2;
}
export function crateFragmentPose(index: number, ageMs: number, startY: number) {
  const t = Math.max(0, ageMs / 1000), vy = 3.1 + index % 4 * .45;
  const landing = (vy + Math.sqrt(vy * vy + 32 * Math.max(0, startY - .07))) / 16;
  const flight = Math.min(t, landing), angle = index * 2.399963229728653;
  const distance = flight * (1.5 + index % 3 * .5);
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance,
    y: Math.max(.07, startY + vy * flight - 8 * flight * flight),
    spin: flight * (index % 2 ? -4 : 4), landed: t >= landing,
    opacity: Math.max(0, 1 - Math.max(0, t - .85) / .35) };
}
