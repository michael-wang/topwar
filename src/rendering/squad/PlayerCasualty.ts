import * as THREE from 'three';
export const PLAYER_CASUALTY_MS = 700;
export const PLAYER_CASUALTY_BLOOD = { bloodStartMs: 0, bloodEndMs: 220, bloodPulseCount: 2, bloodScale: 1.10 } as const;
export const PLAYER_STAIN_DIAMETER = .35;
const smooth = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
export function playerCasualtyPose(ageMs: number, side: number) {
  const fall = smooth((ageMs - 80) / 270);
  return { visible: ageMs >= 0 && ageMs < PLAYER_CASUALTY_MS,
    pitch: .06 * smooth(ageMs / 80) * (1 - fall) + 1.35 * fall,
    roll: .14 * side * fall, x: .10 * side * fall, z: -.18 * fall,
    opacity: 1 - smooth((ageMs - 450) / (PLAYER_CASUALTY_MS - 450)) };
}
// A small support set sampled from real body/helmet/rifle vertices at construction.
// Runtime grounding uses these actual surface points, not oversized AABB corners.
export class PlayerCasualtyGround {
  private readonly support: THREE.Vector3[] = [];
  private readonly rotation = new THREE.Matrix4();
  constructor(group: THREE.Group) {
    const vertices: THREE.Vector3[] = [];
    for (const part of group.children) if (part instanceof THREE.Mesh && part.visible) {
      part.updateMatrix(); const p = part.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) vertices.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(part.matrix));
    }
    for (const side of [-1.2, 0, 1.2]) for (let sample = 0; sample <= 24; sample++) {
      const pose = playerCasualtyPose(80 + sample / 24 * 270, side);
      this.rotation.makeRotationFromEuler(new THREE.Euler(pose.pitch, 0, pose.roll));
      const e = this.rotation.elements;
      let lowest: THREE.Vector3 | undefined, floor = Infinity;
      for (const vertex of vertices) {
        const y = vertex.x * e[1] + vertex.y * e[5] + vertex.z * e[9];
        if (y < floor) { floor = y; lowest = vertex; }
      }
      if (lowest && !this.support.some(point => point.equals(lowest))) this.support.push(lowest.clone());
    }
  }
  floorY(rotation: THREE.Euler, scale: number): number {
    this.rotation.makeRotationFromEuler(rotation); const e = this.rotation.elements;
    let minimum = Infinity;
    for (const vertex of this.support) minimum = Math.min(minimum, vertex.x * e[1] + vertex.y * e[5] + vertex.z * e[9]);
    return .02 - (Number.isFinite(minimum) ? minimum * scale : 0);
  }
}
