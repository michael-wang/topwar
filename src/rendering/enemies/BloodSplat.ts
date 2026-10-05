import * as THREE from 'three';
import { bloodSplatPose, ENEMY_DEATH_TIMING, type BloodSplatTiming, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
import { bloodStainVariation, STAIN_COLORS } from './BloodStainVariation';

export const BLOOD_SPLAT_CAPACITY = 64;
export const BLOOD_STAIN_CAPACITY = 1024;
export const BLOOD_STAIN_GROW_MS = 110;
export const BLOOD_COLORS = ['#7e2029', '#a92c38', '#d0444c'] as const;
export const BLOOD_STAIN_COLOR = '#6d2528';
export const BLOOD_STAIN_OPACITY = .58;

// An asymmetric connected blot, with uneven lobes and a few satellite splashes.
// The same deterministic mask serves camera-facing bursts and flat sand stains.
export function bloodSplatTexture(variant = 0, fuller = false): THREE.DataTexture {
  const size = 96, data = new Uint8Array(size * size * 4);
  const spots = [[-.72,.30,.10], [.62,.54,.075], [.70,-.36,.12], [-.32,-.73,.065], [-.76,-.42,.055]];
  if (variant > 0) {
    spots.length = 2 + variant % 3;
    spots.forEach((spot, i) => {
      spot[0] += Math.sin(variant * 1.7 + i) * .07;
      spot[1] += Math.cos(variant + i * 2.4) * .08;
      spot[2] *= .8 + .2 * Math.sin(variant + i);
    });
  }
  // Unequal overlapping lobes and two thin splash tails avoid a radial star/flower.
  const lobes = [[0,.02,.53,.48,0], [-.34,.16,.25,.24,.2], [.33,-.10,.27,.21,-.3],
    [-.12,-.37,.21,.19,0], [.24,.30,.16,.23,.2], [-.31,-.26,.16,.24,.45],
    [-.52,.36,.25,.05,-.65], [.48,.32,.26,.065,.55]];
  if (fuller) lobes.push([-.46,-.10,.24,.19,-.2], [.45,.04,.23,.28,.3], [-.02,.47,.21,.22,-.3]);
  if (variant > 0) for (let i = 0; i < lobes.length; i++) {
    const lobe = lobes[i];
    // Same palette/edge language, distinct broad silhouettes rather than rotations.
    lobe[0] += Math.sin(i * 2.7 + variant * 1.9) * .13;
    lobe[1] += Math.cos(i * 1.8 + variant) * .12;
    lobe[2] *= variant === 1 ? .82 : variant === 2 ? 1.05 : 1.20;
    lobe[3] *= variant === 1 ? 1.18 : variant === 2 ? .90 : .82;
    lobe[4] += variant * .23;
  }
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

// Four 96px cells, one texture and one draw. Enemy stains share the fuller atlas;
// Player blood retains its original single mask.
function bloodAtlas(fuller: boolean): THREE.DataTexture {
  const size = 192, data = new Uint8Array(size * size * 4);
  for (let variant = 0; variant < 4; variant++) {
    const cell = bloodSplatTexture(variant + 1, fuller), source = cell.image.data;
    for (let y = 0; y < 96; y++) {
      const target = ((y + Math.floor(variant / 2) * 96) * size + (variant % 2) * 96) * 4;
      data.set(source.subarray(y * 96 * 4, (y + 1) * 96 * 4), target);
    }
    cell.dispose();
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}
export const hitBloodAtlas = (): THREE.DataTexture => bloodAtlas(false);
export const groundBloodAtlas = (): THREE.DataTexture => bloodAtlas(true);
export interface SplatVariation {
  variant: number; angle: number; aspect: number; size: number;
  bias?: number; localAnchor?: readonly [number, number, number];
}

interface BurstSlot { owner: number; startedAt: number; timing: BloodSplatTiming; origin: THREE.Vector3;
  localAnchor: THREE.Vector3; attached: boolean; bias: number;
  diameter: number; angle: number; variant: number; aspect: number }

export class BloodSplat {
  private readonly mesh: THREE.InstancedMesh;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly angle: THREE.InstancedBufferAttribute;
  private readonly slots: BurstSlot[];
  private readonly variant: THREE.InstancedBufferAttribute;
  private readonly bias: THREE.InstancedBufferAttribute;
  private readonly transform = new THREE.Object3D();
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene, texture: THREE.DataTexture,
    private readonly capacity = BLOOD_SPLAT_CAPACITY, name = 'blood-splats') {
    this.variant = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.bias = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.angle = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.slots = Array.from({ length: capacity }, () => ({ owner: -1, startedAt: -Infinity,
      timing: { bloodStartMs: 0, bloodEndMs: 0, bloodPulseCount: 1, bloodScale: 1 }, origin: new THREE.Vector3(), localAnchor: new THREE.Vector3(),
      attached: false, bias: 0, diameter: 1, angle: 0, variant: 0, aspect: 1 }));
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute('splatVariant', this.variant);
    geometry.setAttribute('splatBias', this.bias);
    geometry.setAttribute('splatOpacity', this.alpha); geometry.setAttribute('splatAngle', this.angle);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
      depthTest: false, toneMapped: false });
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float splatVariant; attribute float splatOpacity; attribute float splatAngle; attribute float splatBias; varying float vSplatOpacity;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>', `#include <uv_vertex>
${texture.image.width === 192 ? 'vMapUv = (vMapUv + vec2(mod(splatVariant, 2.), floor(splatVariant / 2.))) * .5;' : ''}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplatOpacity = splatOpacity;')
        .replace('#include <project_vertex>', `vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
float c = cos(splatAngle), s = sin(splatAngle);
mvPosition.xy += mat2(c,s,-s,c) * ((position.xy + vec2(splatBias,0.)) * size);
gl_Position = projectionMatrix * mvPosition;`);
      shader.fragmentShader = `varying float vSplatOpacity;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vSplatOpacity;');
    };
    material.customProgramCacheKey = () => `actor-camera-blood-blot-${texture.image.width}`;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name; this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.alpha.setUsage(THREE.DynamicDrawUsage); this.angle.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  spawnStyled(id: number, timing: BloodSplatTiming, nowMs: number, origin: THREE.Vector3, adaptation = 1, owner = id, variation?: SplatVariation): void {
    // Reuse expired bursts before interrupting a longer threat payoff.
    let index = this.cursor, oldest = index;
    for (let offset = 0; offset < this.capacity; offset++) {
      const candidate = (this.cursor + offset) % this.capacity;
      const slot = this.slots[candidate];
      if (nowMs >= slot.startedAt + slot.timing.bloodEndMs) { index = candidate; break; }
      if (slot.startedAt < this.slots[oldest].startedAt) oldest = candidate;
      if (offset === this.capacity - 1) index = oldest;
    }
    this.cursor = (index + 1) % this.capacity;
    const slot = this.slots[index];
    slot.owner = owner; slot.startedAt = nowMs; slot.timing = timing; slot.origin.copy(origin);
    slot.diameter = 1.25 * timing.bloodScale * Math.max(.8, Math.min(1.25, adaptation));
    slot.angle = variation?.angle ?? id * 2.3999632297;
    slot.variant = variation?.variant ?? 0; slot.aspect = variation?.aspect ?? 1;
    slot.diameter *= variation?.size ?? 1;
    slot.attached = !!variation?.localAnchor; slot.bias = variation?.bias ?? 0;
    if (variation?.localAnchor) slot.localAnchor.fromArray(variation.localAnchor);
  }
  // Follow the already rendered actor, including every-hit recoil. Slot vectors
  // are preallocated; short splashes don't trail behind the recovering body.
  follow(owner: number, bodyWorld: THREE.Matrix4): void {
    for (const slot of this.slots) if (slot.owner === owner && slot.attached && Number.isFinite(slot.startedAt))
      slot.origin.copy(slot.localAnchor).applyMatrix4(bodyWorld);
  }
  update(nowMs: number): void {
    let count = 0;
    for (const slot of this.slots) {
      const pose = bloodSplatPose(nowMs - slot.startedAt, slot.timing);
      if (!pose.visible) continue;
      this.transform.position.copy(slot.origin); this.transform.scale.set(slot.diameter * pose.scale * slot.aspect, slot.diameter * pose.scale / slot.aspect, 1);
      this.transform.updateMatrix(); this.mesh.setMatrixAt(count, this.transform.matrix);
      this.alpha.setX(count, pose.opacity); this.angle.setX(count, slot.angle); this.variant.setX(count, slot.variant);
      this.bias.setX(count, slot.bias * .10 * Math.min(1, Math.max(0, (nowMs - slot.startedAt) / 50))); count++;
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = this.angle.needsUpdate = this.variant.needsUpdate = this.bias.needsUpdate = true;
  }
  cancel(owner: number): void { for (const slot of this.slots) if (slot.owner === owner) slot.startedAt = -Infinity; }
  reset(): void { this.slots.forEach(slot => slot.startedAt = -Infinity); this.cursor = 0; this.mesh.count = 0; this.mesh.visible = false; }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

export class GroundBloodStains {
  private readonly mesh: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly variant = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_STAIN_CAPACITY), 1);
  private readonly alpha = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_STAIN_CAPACITY).fill(1), 1);
  private readonly growth = new THREE.InstancedBufferAttribute(new Float32Array(BLOOD_STAIN_CAPACITY).fill(1), 1);
  private readonly growthStarts = new Float64Array(BLOOD_STAIN_CAPACITY).fill(-Infinity);
  private readonly atlas: boolean;
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene, texture: THREE.DataTexture, name = 'enemy-ground-blood-stains') {
    this.atlas = texture.image.width === 192;
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute('stainVariant', this.variant); geometry.setAttribute('stainOpacity', this.alpha);
    geometry.setAttribute('stainGrowth', this.growth);
    const material = new THREE.MeshBasicMaterial({ map: texture, color: this.atlas ? '#ffffff' : BLOOD_STAIN_COLOR,
      transparent: true, opacity: this.atlas ? 1 : BLOOD_STAIN_OPACITY, depthWrite: false, toneMapped: false });
    // Borrow the mask alpha; dried blood has independent quiet tint/opacity.
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float stainVariant; attribute float stainOpacity; attribute float stainGrowth; varying float vStainOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= stainGrowth;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${this.atlas ? 'vMapUv = (vMapUv + vec2(mod(stainVariant, 2.), floor(stainVariant / 2.))) * .5;' : ''}\nvStainOpacity = stainOpacity;`);
      shader.fragmentShader = `varying float vStainOpacity;\n${shader.fragmentShader}`.replace('#include <map_fragment>',
        '#ifdef USE_MAP\ndiffuseColor.a *= texture2D(map, vMapUv).a * vStainOpacity;\n#endif');
    };
    material.customProgramCacheKey = () => `flat-persistent-blood-mask-${texture.image.width}`;
    this.mesh = new THREE.InstancedMesh(geometry, material, BLOOD_STAIN_CAPACITY);
    this.mesh.name = name; this.mesh.count = 0; this.mesh.visible = false; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
  }
  spawn(id: number, role: EnemyDeathRole, x: number, z: number): void {
    if (!this.atlas) { this.spawnSized(id, ENEMY_DEATH_TIMING[role].stainDiameter, x, z); return; }
    const index = this.cursor++ % BLOOD_STAIN_CAPACITY, v = bloodStainVariation(id, role);
    this.growthStarts[index] = -Infinity; this.growth.setX(index, 1); this.growth.needsUpdate = true;
    const diameter = ENEMY_DEATH_TIMING[role].stainDiameter * v.scale;
    this.transform.position.set(x + v.offsetX, .032, z + v.offsetZ);
    this.transform.rotation.set(-Math.PI / 2, 0, v.angle);
    this.transform.scale.set(diameter * v.aspect, diameter / v.aspect, 1); this.transform.updateMatrix();
    this.mesh.setMatrixAt(index, this.transform.matrix); this.mesh.setColorAt(index, this.color.set(STAIN_COLORS[v.color]));
    this.variant.setX(index, v.variant); this.alpha.setX(index, v.opacity);
    this.variant.needsUpdate = this.alpha.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true;
    this.mesh.count = Math.min(this.cursor, BLOOD_STAIN_CAPACITY); this.mesh.visible = true; this.mesh.instanceMatrix.needsUpdate = true;
  }
  spawnSized(id: number, diameter: number, x: number, z: number): void {
    const index = this.cursor++ % BLOOD_STAIN_CAPACITY;
    this.growthStarts[index] = -Infinity; this.growth.setX(index, 1); this.growth.needsUpdate = true;
    const variation = .9 + ((Math.imul(id, 1597334677) >>> 0) % 1000) / 5000;
    diameter *= variation;
    this.transform.position.set(x, .025, z); this.transform.rotation.set(-Math.PI / 2, 0, id * 2.3999632297);
    this.transform.scale.set(diameter, diameter, 1); this.transform.updateMatrix();
    this.mesh.setMatrixAt(index, this.transform.matrix); this.mesh.count = Math.min(this.cursor, BLOOD_STAIN_CAPACITY);
    this.mesh.visible = true; this.mesh.instanceMatrix.needsUpdate = true;
  }
  activate(id: number, role: EnemyDeathRole, x: number, z: number, contactMs: number): void {
    this.spawn(id, role, x, z);
    const index = (this.cursor - 1) % BLOOD_STAIN_CAPACITY;
    this.growthStarts[index] = contactMs; this.growth.setX(index, .3); this.growth.needsUpdate = true;
  }
  update(nowMs: number): void {
    let changed = false;
    for (let index = 0; index < this.mesh.count; index++) {
      if (!Number.isFinite(this.growthStarts[index])) continue;
      const t = Math.max(0, Math.min(1, (nowMs - this.growthStarts[index]) / BLOOD_STAIN_GROW_MS));
      this.growth.setX(index, .3 + .7 * t * t * (3 - 2 * t)); changed = true;
      if (t === 1) this.growthStarts[index] = -Infinity;
    }
    if (changed) this.growth.needsUpdate = true;
  }
  reset(): void {
    this.cursor = 0; this.mesh.count = 0; this.mesh.visible = false;
    this.growthStarts.fill(-Infinity); this.growth.array.fill(1); this.growth.needsUpdate = true;
  }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
