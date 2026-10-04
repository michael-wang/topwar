import * as THREE from 'three';
import { bloodSplatPose, ENEMY_DEATH_TIMING, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const BLOOD_SPLAT_CAPACITY = 64;
export const BLOOD_STAIN_CAPACITY = 1024;
export const BLOOD_COLORS = ['#7e2029', '#a92c38', '#d0444c'] as const;
export const BLOOD_STAIN_COLOR = '#6d2528';
export const BLOOD_STAIN_OPACITY = .58;

// An asymmetric connected blot, with uneven lobes and a few satellite splashes.
// The same deterministic mask serves camera-facing bursts and flat sand stains.
export function bloodSplatTexture(): THREE.DataTexture {
  const size = 96, data = new Uint8Array(size * size * 4);
  const spots = [[-.72,.30,.10], [.62,.54,.075], [.70,-.36,.12], [-.32,-.73,.065], [-.76,-.42,.055]];
  // Unequal overlapping lobes and two thin splash tails avoid a radial star/flower.
  const lobes = [[0,.02,.53,.48,0], [-.34,.16,.25,.24,.2], [.33,-.10,.27,.21,-.3],
    [-.12,-.37,.21,.19,0], [.24,.30,.16,.23,.2], [-.31,-.26,.16,.24,.45],
    [-.52,.36,.25,.05,-.65], [.48,.32,.26,.065,.55]];
  const colors = BLOOD_COLORS.map(hex => new THREE.Color(hex).convertLinearToSRGB());
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5) / size * 2 - 1, dy = (y + .5) / size * 2 - 1;
    let distance = -1;
    for (const [cx, cy, rx, ry, angle] of lobes) {
      const c = Math.cos(angle), s = Math.sin(angle), x = dx - cx, y = dy - cy;
      const radius = Math.hypot((x * c + y * s) / rx, (-x * s + y * c) / ry);
      distance = Math.max(distance, (1 - radius) * Math.min(rx, ry));
    }
    distance += .008 * Math.sin(dx * 49 + dy * 13) + .005 * Math.cos(dy * 67 + dx * 9);
    let coverage = Math.max(0, Math.min(1, distance * 80));
    for (const [sx, sy, r] of spots) coverage = Math.max(coverage,
      Math.max(0, Math.min(1, (r - Math.hypot(dx - sx, dy - sy)) * 90)));
    const tinyAccent = Math.hypot(dx + .72, dy - .30) < .10;
    const tone = tinyAccent ? colors[2] : distance < .025 ? colors[0] : colors[1];
    const at = (y * size + x) * 4;
    // DataTexture bytes are sRGB, converted by the standard map pipeline.
    const color = tone;
    data[at] = Math.round(color.r * 255); data[at + 1] = Math.round(color.g * 255);
    data[at + 2] = Math.round(color.b * 255); data[at + 3] = Math.round(coverage * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

interface BurstSlot { startedAt: number; role: EnemyDeathRole; origin: THREE.Vector3; diameter: number; angle: number }

export class BloodSplat {
  private readonly mesh: THREE.InstancedMesh;
  private readonly alpha = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_SPLAT_CAPACITY), 1);
  private readonly angle = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_SPLAT_CAPACITY), 1);
  private readonly slots: BurstSlot[] = Array.from({ length: BLOOD_SPLAT_CAPACITY }, () => ({
    startedAt: -Infinity, role: 'grunt', origin: new THREE.Vector3(), diameter: 1, angle: 0 }));
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene, texture: THREE.DataTexture) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute('splatOpacity', this.alpha); geometry.setAttribute('splatAngle', this.angle);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
      depthTest: false, toneMapped: false });
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float splatOpacity; attribute float splatAngle; varying float vSplatOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplatOpacity = splatOpacity;')
        .replace('#include <project_vertex>', `vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
float c = cos(splatAngle), s = sin(splatAngle);
mvPosition.xy += mat2(c,s,-s,c) * (position.xy * size);
gl_Position = projectionMatrix * mvPosition;`);
      shader.fragmentShader = `varying float vSplatOpacity;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vSplatOpacity;');
    };
    material.customProgramCacheKey = () => 'pooled-camera-blood-blot';
    this.mesh = new THREE.InstancedMesh(geometry, material, BLOOD_SPLAT_CAPACITY);
    this.mesh.name = 'enemy-blood-splats'; this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.alpha.setUsage(THREE.DynamicDrawUsage); this.angle.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  spawn(id: number, role: EnemyDeathRole, nowMs: number, origin: THREE.Vector3, adaptation: number): void {
    // Reuse expired Grunt bursts before interrupting a longer threat payoff.
    let index = this.cursor, oldest = index;
    for (let offset = 0; offset < BLOOD_SPLAT_CAPACITY; offset++) {
      const candidate = (this.cursor + offset) % BLOOD_SPLAT_CAPACITY;
      const slot = this.slots[candidate];
      if (nowMs >= slot.startedAt + ENEMY_DEATH_TIMING[slot.role].bloodEndMs) { index = candidate; break; }
      if (slot.startedAt < this.slots[oldest].startedAt) oldest = candidate;
      if (offset === BLOOD_SPLAT_CAPACITY - 1) index = oldest;
    }
    this.cursor = (index + 1) % BLOOD_SPLAT_CAPACITY;
    const slot = this.slots[index];
    slot.startedAt = nowMs; slot.role = role; slot.origin.copy(origin);
    slot.diameter = 1.25 * ENEMY_DEATH_TIMING[role].bloodScale * Math.max(.8, Math.min(1.25, adaptation));
    slot.angle = id * 2.3999632297;
  }
  update(nowMs: number): void {
    let count = 0;
    for (const slot of this.slots) {
      const pose = bloodSplatPose(nowMs - slot.startedAt, ENEMY_DEATH_TIMING[slot.role]);
      if (!pose.visible) continue;
      this.transform.position.copy(slot.origin); this.transform.scale.setScalar(slot.diameter * pose.scale);
      this.transform.updateMatrix(); this.mesh.setMatrixAt(count, this.transform.matrix);
      this.alpha.setX(count, pose.opacity); this.angle.setX(count, slot.angle); count++;
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = this.angle.needsUpdate = true;
  }
  reset(): void { this.slots.forEach(slot => slot.startedAt = -Infinity); this.cursor = 0; this.mesh.count = 0; this.mesh.visible = false; }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

export class GroundBloodStains {
  private readonly mesh: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene, texture: THREE.DataTexture) {
    const material = new THREE.MeshBasicMaterial({ map: texture, color: BLOOD_STAIN_COLOR,
      transparent: true, opacity: BLOOD_STAIN_OPACITY, depthWrite: false, toneMapped: false });
    // Read only map alpha: the sand stain has its own quiet, uniform dark-red tint.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        '#ifdef USE_MAP\ndiffuseColor.a *= texture2D(map, vMapUv).a;\n#endif');
    };
    material.customProgramCacheKey = () => 'flat-persistent-blood-mask';
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, BLOOD_STAIN_CAPACITY);
    this.mesh.name = 'enemy-ground-blood-stains'; this.mesh.count = 0; this.mesh.visible = false; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
  }
  spawn(id: number, role: EnemyDeathRole, x: number, z: number): void {
    const index = this.cursor++ % BLOOD_STAIN_CAPACITY;
    const variation = .9 + ((Math.imul(id, 1597334677) >>> 0) % 1000) / 5000;
    const diameter = ENEMY_DEATH_TIMING[role].stainDiameter * variation;
    this.transform.position.set(x, .025, z); this.transform.rotation.set(-Math.PI / 2, 0, id * 2.3999632297);
    this.transform.scale.set(diameter, diameter, 1); this.transform.updateMatrix();
    this.mesh.setMatrixAt(index, this.transform.matrix); this.mesh.count = Math.min(this.cursor, BLOOD_STAIN_CAPACITY);
    this.mesh.visible = true; this.mesh.instanceMatrix.needsUpdate = true;
  }
  reset(): void { this.cursor = 0; this.mesh.count = 0; this.mesh.visible = false; }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
