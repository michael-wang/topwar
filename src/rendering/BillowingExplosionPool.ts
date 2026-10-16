import * as THREE from 'three';
import { smokeWindX } from '../presentation/BattlefieldWind';

const BAND_SIZE = [.31, .25, .20] as const;
const BAND_ALPHA = [.20, .40, .64] as const;
const BAND_COLOR = ['#969b9b', '#51585a', '#303739'] as const;

/** Accepted cloud math, batched across the whole pool in Lab painter order. */
export class BillowingExplosionPool {
  private readonly sphere = new THREE.SphereGeometry(1, 12, 8);
  private readonly pose = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private smokeSlots: number;
  private readonly slots: { x: number; z: number; atMs: number }[];
  private readonly activeSlots: Uint8Array;
  private readonly smoke: ReturnType<BillowingExplosionPool['batch']>;
  private readonly fire: ReturnType<BillowingExplosionPool['batch']>;
  private readonly core: ReturnType<BillowingExplosionPool['batch']>;
  private readonly rings: ReturnType<BillowingExplosionPool['batch']>[];
  private readonly outer: ReturnType<BillowingExplosionPool['batch']>[];
  private readonly hotSphere: THREE.SphereGeometry | null;
  private readonly ring: THREE.RingGeometry | null;
  private activeCount = 0;
  readonly durationMs: number;
  constructor(private readonly scene: THREE.Scene, readonly capacity: number, private readonly mode: 'impact' | 'airstrike' = 'impact') {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 12) throw Error('Invalid explosion capacity');
    const air = mode === 'airstrike'; this.durationMs = air ? 2000 : 1500;
    this.hotSphere = air ? new THREE.SphereGeometry(1, 9, 6) : null;
    this.ring = air ? new THREE.RingGeometry(.82, 1, 32) : null;
    this.slots = Array.from({ length: capacity }, () => ({ x: 0, z: 0, atMs: -Infinity }));
    this.activeSlots = new Uint8Array(capacity);
    this.smokeSlots = capacity;
    const positions = this.sphere.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const scale = 1 + .10 * Math.sin(x * 7 + y * 4) * Math.cos(z * 6 - y * 3);
      positions.setXYZ(i, x * scale, y * scale, z * scale);
    }
    this.sphere.computeVertexNormals();
    const prefix = air ? 'airstrike' : 'artillery-impact';
    this.smoke = this.batch(`${prefix}-smoke`, (air ? 16 : 24) * capacity, '#ffffff', air ? 1 : 0);
    this.fire = this.batch(`${prefix}-fire`, 3 * capacity, '#ff8c24', 3);
    this.core = this.batch(`${prefix}-flash`, capacity, air ? '#fff5d1' : '#fff3c2', 4, this.hotSphere ?? this.sphere);
    // The Lab interleaves distant outer envelopes and ground rings by depth.
    // Retain those inexpensive per-impact views; batch both inner bands, fire and flash.
    this.outer = air ? Array.from({ length: capacity }, (_, i) => this.batch(`airstrike-outer-${i}`, 8, BAND_COLOR[0], 0)) : [];
    this.rings = this.ring ? Array.from({ length: capacity }, (_, i) => this.batch(`airstrike-shockwave-${i}`, 1, '#ffc271', 0, this.ring!)) : [];
    for (const ring of this.rings) { ring.mesh.material.side = THREE.DoubleSide; ring.mesh.material.forceSinglePass = true; }
    const color = new THREE.Color();
    for (let band = air ? 1 : 0; band < 3; band++) for (let slot = 0; slot < capacity; slot++) for (let i = 0; i < 8; i++)
      this.smoke.mesh.setColorAt(this.smokeIndex(band, slot, i), color.set(BAND_COLOR[band]).multiplyScalar(.85 + i % 3 * .075));
    for (const outer of this.outer) for (let i = 0; i < 8; i++) outer.mesh.setColorAt(i, color.setScalar(.85 + i % 3 * .075));
    this.reset();
  }
  private smokeIndex(band: number, slot: number, lobe: number, slots = this.capacity): number { return (band - (this.mode === 'airstrike' ? 1 : 0)) * slots * 8 + slot * 8 + lobe; }
  private batch(name: string, count: number, color: string, order: number, source: THREE.BufferGeometry = this.sphere) {
    const geometry = source.clone(), alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    alpha.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('fxOpacity', alpha);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float fxOpacity; varying float vFxOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFxOpacity = fxOpacity;');
      shader.fragmentShader = `varying float vFxOpacity;\n${shader.fragmentShader}`
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFxOpacity;');
    };
    material.customProgramCacheKey = () => 'billowing-explosion-opacity';
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name; mesh.renderOrder = order; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(mesh);
    return { mesh, alpha };
  }
  present(x: number, z: number, _radius: number, atMs: number): void {
    let index = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (atMs - this.slots[i].atMs >= this.durationMs) { index = i; break; }
      if (this.slots[i].atMs < this.slots[index].atMs) index = i;
    }
    this.setImpact(index, x, z, atMs);
  }
  setImpact(index: number, x: number, z: number, atMs: number): void {
    const slot = this.slots[index % this.capacity]; slot.x = x; slot.z = z; slot.atMs = atMs;
  }
  update(nowMs: number, originZ: number): void {
    this.smoke.alpha.array.fill(0); this.fire.alpha.array.fill(0); this.core.alpha.array.fill(0);
    for (const ring of this.rings) { ring.alpha.array.fill(0); ring.mesh.visible = false; }
    for (const outer of this.outer) { outer.alpha.array.fill(0); outer.mesh.visible = false; }
    const air = this.mode === 'airstrike';
    this.activeCount = 0; let fires = false, cores = false, packed = 0;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (nowMs >= s.atMs && nowMs - s.atMs < this.durationMs) this.activeSlots[this.activeCount++] = i;
    }
    if (air) for (let i = 1; i < this.activeCount; i++) {
      const index = this.activeSlots[i], next = this.slots[index]; let j = i;
      while (j > 0) {
        const previous = this.slots[this.activeSlots[j - 1]];
        if (previous.z > next.z || previous.z === next.z && previous.atMs >= next.atMs) break;
        this.activeSlots[j] = this.activeSlots[j - 1]; j--;
      }
      this.activeSlots[j] = index;
    }
    this.smoke.mesh.count = this.activeCount * (air ? 16 : 24);
    if (this.activeCount > 0 && this.smokeSlots !== this.activeCount) {
      for (let band = air ? 1 : 0; band < 3; band++) for (let slot = 0; slot < this.activeCount; slot++) for (let i = 0; i < 8; i++)
        this.smoke.mesh.setColorAt(this.smokeIndex(band, slot, i, this.activeCount), this.color.set(BAND_COLOR[band]).multiplyScalar(.85 + i % 3 * .075));
      this.smoke.mesh.instanceColor!.needsUpdate = true; this.smokeSlots = this.activeCount;
    }
    for (let n = 0; n < this.activeCount; n++) {
      const slot = this.activeSlots[n];
      const s = this.slots[slot], t = (nowMs - s.atMs) / 1000;
      if (t < 0 || t >= this.durationMs / 1000) continue;
      const x = -s.x, z = s.z - originZ, r = air ? 7.2 : 3.6;
      const growth = 1 - Math.exp(-Math.max(0, t) * (air ? 4 : 12));
      const driftAge = Math.max(0, t - (air ? .16 : .08)), wind = smokeWindX(driftAge);
      const fade = Math.min(1, Math.max(0, (this.durationMs / 1000 - t) / (air ? .5 : .6))) ** 3;
      const dispersal = air ? 0 : Math.max(0, t - .35);
      for (let band = 0; band < 3; band++) {
        const size = r * BAND_SIZE[band] * (band === 2 ? .88 : 1) * (.65 + growth * .55 + t * .07);
        for (let i = 0; i < 8; i++) {
          const angle = i * 2.399963, spread = size * (.58 + dispersal * .25);
          const curl = Math.sin(t * 1.3 + i) * .10 * growth;
          const rollX = (i % 3 - 1) * .8 + Math.cos(angle) * .23, rollY = (Math.floor(i / 3) - 1) * .30;
          this.pose.position.set(x + wind + rollX * spread, .45 + band * .12 + size * .45 + driftAge * .65 + rollY * spread + curl,
            z + Math.sin(angle) * spread * .65);
          this.pose.scale.set(size * 1.02 * (1 + dispersal * .6), size * (.72 + i % 3 * .09), size * .82);
          this.pose.rotation.set(i * .7, angle, curl); this.pose.updateMatrix();
          const target = air && band === 0 ? this.outer[slot] : this.smoke;
          const index = air && band === 0 ? i : this.smokeIndex(band, packed, i, this.activeCount);
          target.mesh.setMatrixAt(index, this.pose.matrix); target.alpha.setX(index, BAND_ALPHA[band] * fade);
        }
      }
      if (air) {
        const outer = this.outer[slot]; outer.mesh.visible = true; outer.mesh.instanceMatrix.needsUpdate = true; outer.alpha.needsUpdate = true;
        outer.mesh.computeBoundingSphere();
      }
      packed++;
      if (air ? t >= .05 && t < .30 : t < .22) {
        fires = true;
        for (let i = 0; i < 3; i++) {
          this.pose.position.set(x + Math.cos(i * 2.4) * r * .10 * growth, .6 + i * .15, z + Math.sin(i * 2.4) * r * .10 * growth);
          this.pose.rotation.set(i, i * 2.4, 0); this.pose.scale.setScalar(r * (.12 + growth * .045)); this.pose.updateMatrix();
          this.fire.mesh.setMatrixAt(slot * 3 + i, this.pose.matrix);
          this.fire.alpha.setX(slot * 3 + i, air ? .70 * Math.max(0, 1 - (t - .05) / .25) : .95 * Math.max(0, 1 - t / .22));
        }
      }
      if (t < (air ? .15 : .085)) {
        cores = true; this.pose.position.set(x, air ? 2.5 : .7, z); this.pose.rotation.set(0, 0, 0);
        this.pose.scale.setScalar(air ? 4.8 * (.22 + .32 * Math.min(1, t / .18)) : r * (.12 + growth * .08)); this.pose.updateMatrix();
        this.core.mesh.setMatrixAt(slot, this.pose.matrix); this.core.alpha.setX(slot, Math.max(0, 1 - t / (air ? .15 : .085)));
      }
      const shock = this.rings[slot];
      if (shock && t < .6) {
        shock.mesh.visible = true; this.pose.position.set(x, .1, z); this.pose.rotation.set(-Math.PI / 2, 0, 0);
        this.pose.scale.setScalar(4.8 * (1 + t * 2.3)); this.pose.updateMatrix();
        shock.mesh.setMatrixAt(0, this.pose.matrix); shock.alpha.setX(0, .85 * Math.max(0, 1 - t / .6));
        shock.mesh.computeBoundingSphere();
      }
    }
    this.smoke.mesh.visible = this.activeCount > 0; this.fire.mesh.visible = fires; this.core.mesh.visible = cores;
    this.smoke.mesh.instanceMatrix.needsUpdate = this.fire.mesh.instanceMatrix.needsUpdate = this.core.mesh.instanceMatrix.needsUpdate = true;
    this.smoke.alpha.needsUpdate = this.fire.alpha.needsUpdate = this.core.alpha.needsUpdate = true;
    for (const ring of this.rings) { ring.mesh.instanceMatrix.needsUpdate = true; ring.alpha.needsUpdate = true; }
  }
  get active(): number { return this.activeCount; }
  reset(): void {
    for (const slot of this.slots) slot.atMs = -Infinity;
    this.activeCount = 0;
    for (const batch of [this.smoke, this.fire, this.core]) { batch.mesh.visible = false; batch.alpha.array.fill(0); batch.alpha.needsUpdate = true; }
    for (const batch of [...this.outer, ...this.rings]) { batch.mesh.visible = false; batch.alpha.array.fill(0); batch.alpha.needsUpdate = true; }
  }
  dispose(): void {
    for (const batch of [this.smoke, this.fire, this.core]) {
      this.scene.remove(batch.mesh); batch.mesh.dispose(); batch.mesh.geometry.dispose(); batch.mesh.material.dispose();
    }
    this.sphere.dispose();
    for (const batch of [...this.outer, ...this.rings]) { this.scene.remove(batch.mesh); batch.mesh.dispose(); batch.mesh.geometry.dispose(); batch.mesh.material.dispose(); }
    this.hotSphere?.dispose(); this.ring?.dispose();
  }
}
