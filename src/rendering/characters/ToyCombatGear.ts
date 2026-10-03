import * as THREE from 'three';

// Rendering-only clothing/field-gear colors. Costume values never enter combat.
export const COMBAT_COLORS = {
  player: { trousers: '#365973', gear: '#4c6673' },
  grunt: { belt: '#526358', canteen: '#8e9987' },
  heavy: { shirt: '#59674c', trousers: '#4e6067', helmet: '#626f51', harness: '#989077', pouch: '#7e836a' },
  giant: { sash: '#85856d', satchel: '#747f66' },
} as const;

// A broad soft strip on an ellipsoid. Tilt happens before scaling so even the
// diagonal harness follows the body surface, rather than becoming a chest slab.
// Two latitude spans and 16 radial segments keep crowd gear inexpensive. The
// cloth clearance must exceed chord sag against the smoother underlying body.
export function toyClothBand(rx: number, ry: number, rz: number, centerY: number,
  latitude: number, halfWidth: number, tilt = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, 16, 2, 0, Math.PI * 2,
    latitude - halfWidth, halfWidth * 2).rotateZ(tilt)
    .scale(rx + .018, ry + .018, rz + .018).translate(0, centerY, 0);
}

export function toyWaistBand(rx: number, ry: number, rz: number, centerY: number,
  waistY: number, height: number): THREE.BufferGeometry {
  const top = Math.acos((waistY + height / 2 - centerY) / ry);
  const bottom = Math.acos((waistY - height / 2 - centerY) / ry);
  return toyClothBand(rx, ry, rz, centerY, (top + bottom) / 2, (bottom - top) / 2);
}
