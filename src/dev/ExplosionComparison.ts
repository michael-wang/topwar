import * as THREE from 'three';
import { GrenadeExplosion } from '../rendering/GrenadeExplosion';
import { HeavyAirstrikeExplosion } from '../rendering/HeavyAirstrikeExplosion';
import { smokeWindX } from '../presentation/BattlefieldWind';

export type ComparisonGroup = 'impact' | 'airstrike';
export type ExplosionLook = 'control' | 'A' | 'B' | 'C' | 'B-fast' | 'D';
export const COMPARISON_LOOKS = { impact: ['control', 'A', 'B', 'B-fast'], airstrike: ['control', 'B', 'C', 'D'] } as const;
const BAND_SIZE = [.31, .25, .20] as const;
const BAND_ALPHA = [.23, .43, .82] as const;
const BILLOW_ALPHA = [.20, .40, .64] as const;
const BANK_ALPHA = [.12, .54, .82] as const;
// Presentation samples only: no Simulation, gameplay RNG, storage or damage events.
export const COMPARISON_IMPACTS = [
  { at: 0, x: 0, z: 5 }, { at: 350, x: -2.5, z: 12 }, { at: 700, x: 2.5, z: 19 },
  { at: 1200, x: -2.5, z: 5 }, { at: 1550, x: 2.5, z: 12 }, { at: 1900, x: 0, z: 19 },
  { at: 2400, x: 2.5, z: 5 }, { at: 2750, x: 0, z: 12 }, { at: 3100, x: -2.5, z: 19 },
] as const;

/** DEV-only analytic experiment. Three interlocking tonal bands share one drifting body. */
class ExperimentalCloud {
  private readonly geometry = new THREE.SphereGeometry(1, 12, 8);
  private readonly hybridFlash: THREE.SphereGeometry | null;
  private readonly hybridRing: THREE.RingGeometry | null;
  private readonly pose = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly slots: ReturnType<ExperimentalCloud['slot']>[] = [];
  constructor(private readonly scene: THREE.Scene, private readonly group: ComparisonGroup,
    private readonly look: Exclude<ExplosionLook, 'control'>) {
    // D selectively keeps Control's flash/ring, not its full fire/smoke renderer.
    this.hybridFlash = look === 'D' ? new THREE.SphereGeometry(1, 9, 6) : null;
    this.hybridRing = look === 'D' ? new THREE.RingGeometry(.82, 1, 32) : null;
    // Irregular silhouettes, authored once. No noise textures or per-frame particles.
    const position = this.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const scale = 1 + .10 * Math.sin(x * 7 + y * 4) * Math.cos(z * 6 - y * 3);
      position.setXYZ(i, x * scale, y * scale, z * scale);
    }
    this.geometry.computeVertexNormals();
    for (let i = 0; i < (group === 'impact' ? 1 : 9); i++) this.slots.push(this.slot(i));
  }
  private slot(index: number) {
    const billowing = this.look === 'B' || this.look === 'B-fast' || this.look === 'D';
    const bands = ['#969b9b', '#51585a', billowing ? '#303739' : '#171d20'].map((color, band) => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
      const mesh = new THREE.InstancedMesh(this.geometry, material, 8);
      mesh.name = `lab-${index}-band-${band}`; mesh.frustumCulled = false;
      mesh.renderOrder = band; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < 8; i++) mesh.setColorAt(i, this.color.setScalar(.85 + i % 3 * .075));
      this.scene.add(mesh); return mesh;
    });
    const fire = new THREE.InstancedMesh(this.geometry,
      new THREE.MeshBasicMaterial({ color: '#ff8c24', transparent: true, depthWrite: false }), 3);
    fire.name = `lab-${index}-fire`; fire.renderOrder = 3; fire.frustumCulled = false;
    fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const core = new THREE.Mesh(this.hybridFlash ?? this.geometry,
      new THREE.MeshBasicMaterial({ color: this.hybridFlash ? '#fff5d1' : '#fff3c2', transparent: true, depthWrite: false }));
    core.name = `lab-${index}-flash`; core.renderOrder = 4;
    const shock = this.hybridRing ? new THREE.Mesh(this.hybridRing,
      new THREE.MeshBasicMaterial({ color: '#ffc271', transparent: true, depthWrite: false, side: THREE.DoubleSide })) : null;
    if (shock) { shock.name = `lab-${index}-shockwave`; shock.rotation.x = -Math.PI / 2; this.scene.add(shock); }
    this.scene.add(fire, core); return { bands, fire, core, shock };
  }
  update(ms: number): void {
    const air = this.group === 'airstrike', fast = this.look === 'B-fast', hybrid = this.look === 'D';
    const billowing = this.look === 'B' || fast || hybrid;
    const duration = fast ? 1.5 : hybrid ? 2 : air ? 5.6 : 1.8;
    for (let slot = 0; slot < this.slots.length; slot++) {
      const event = COMPARISON_IMPACTS[slot], s = this.slots[slot];
      const t = (ms - event.at) / 1000, active = t >= 0 && t < duration;
      const x = -event.x, z = event.z, r = air ? 7.2 : 3.6;
      const growth = 1 - Math.exp(-Math.max(0, t) * (fast ? 12 : this.look === 'A' ? 7 : 4));
      const driftAge = Math.max(0, t - (fast ? .08 : .16)), wind = smokeWindX(driftAge);
      const linearFade = Math.min(1, Math.max(0, (duration - t) / (hybrid ? .5 : duration * .4)));
      // Overlapping lobes compound alpha; linear half-opacity still reads almost solid.
      const fade = fast || hybrid ? linearFade ** 3 : linearFade;
      const dispersal = fast ? Math.max(0, t - .35) : 0;
      for (let band = 0; band < 3; band++) {
        const mesh = s.bands[band]; mesh.visible = active;
        if (!active) continue;
        // A has a distinct early black core; B rolls as one body; C is broader, dirtier and lower.
        const bank = this.look === 'C', rolling = this.look !== 'A';
        const size = r * BAND_SIZE[band] * (billowing && band === 2 ? .88 : 1)
          * (.65 + growth * .55 + Math.max(0, t) * .07);
        mesh.material.opacity = (bank ? BANK_ALPHA : billowing ? BILLOW_ALPHA : BAND_ALPHA)[band] * fade;
        for (let i = 0; i < 8; i++) {
          const angle = i * 2.399963, spread = size * (rolling ? .58 + dispersal * .25 : .85);
          const curl = rolling ? Math.sin(t * 1.3 + i) * .10 * growth : 0;
          const rollX = rolling ? ((i % 3 - 1) * .8 + Math.cos(angle) * .23) : Math.cos(angle);
          const rollY = rolling ? (Math.floor(i / 3) - 1) * .30 : Math.sin(angle) * .28;
          this.pose.position.set(x + wind + rollX * spread * (bank ? 1.5 : 1),
            .45 + band * .12 + size * .45 + driftAge * (bank ? .35 : .65)
              + rollY * spread + curl,
            z + Math.sin(angle) * spread * .65);
          this.pose.scale.set(size * (bank ? 1.3 : 1.02) * (1 + dispersal * .6), size * (.72 + i % 3 * .09), size * .82);
          this.pose.rotation.set(i * .7, angle, curl); this.pose.updateMatrix();
          mesh.setMatrixAt(i, this.pose.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      s.fire.visible = active && (hybrid ? t >= .05 && t < .30 : t < .22);
      s.core.visible = active && t < (hybrid ? .15 : .085);
      if (s.shock) {
        s.shock.visible = active && t < .6;
        s.shock.position.set(x, .1, z); s.shock.scale.setScalar(4.8 * (1 + t * 2.3));
        s.shock.material.opacity = .85 * Math.max(0, 1 - t / .6);
      }
      if (!active) continue;
      s.fire.material.opacity = hybrid ? .70 * Math.max(0, 1 - (t - .05) / .25) : .95 * Math.max(0, 1 - t / .22);
      s.core.material.opacity = Math.max(0, 1 - t / (hybrid ? .15 : .085));
      s.core.position.set(x, hybrid ? 2.5 : .7, z);
      s.core.scale.setScalar(hybrid ? 4.8 * (.22 + .32 * Math.min(1, t / .18)) : r * (.12 + growth * .08));
      for (let i = 0; i < 3; i++) {
        this.pose.position.set(x + Math.cos(i * 2.4) * r * .10 * growth, .6 + i * .15,
          z + Math.sin(i * 2.4) * r * .10 * growth);
        this.pose.rotation.set(i, i * 2.4, 0);
        this.pose.scale.setScalar(r * (.12 + growth * .045)); this.pose.updateMatrix();
        s.fire.setMatrixAt(i, this.pose.matrix);
      }
      s.fire.instanceMatrix.needsUpdate = true;
    }
  }
  dispose(): void {
    for (const s of this.slots) {
      for (const mesh of [...s.bands, s.fire, s.core]) {
        this.scene.remove(mesh); mesh.material.dispose();
        if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
      }
      if (s.shock) { this.scene.remove(s.shock); s.shock.material.dispose(); }
    }
    this.geometry.dispose(); this.hybridFlash?.dispose(); this.hybridRing?.dispose();
  }
}

/** Absolute-time seeking reconstructs the same sample independent of frame rate or playback order. */
export class ExplosionComparison {
  private readonly impact: GrenadeExplosion | null;
  private readonly air: HeavyAirstrikeExplosion | null;
  private readonly experiment: ExperimentalCloud | null;
  readonly durationMs: number;
  constructor(scene: THREE.Scene, readonly group: ComparisonGroup, readonly look: ExplosionLook) {
    if (!(COMPARISON_LOOKS[group] as readonly string[]).includes(look)) throw Error('Invalid explosion comparison');
    this.impact = look === 'control' && group === 'impact' ? new GrenadeExplosion(scene, 1, false, 'artillery') : null;
    this.air = look === 'control' && group === 'airstrike' ? new HeavyAirstrikeExplosion(scene) : null;
    this.experiment = look !== 'control' ? new ExperimentalCloud(scene, group, look) : null;
    this.durationMs = group === 'impact' ? 2200 : 9000;
  }
  seek(ms: number): void {
    this.impact?.reset(); this.air?.reset();
    for (let i = 0; i < (this.group === 'impact' ? 1 : COMPARISON_IMPACTS.length); i++) {
      const e = COMPARISON_IMPACTS[i];
      if (ms < e.at) continue;
      this.impact?.present(e.x, e.z, .588, e.at); this.air?.present(i, e.x, e.z, e.at);
    }
    this.impact?.update(ms, 0); this.air?.update(ms, 0); this.experiment?.update(ms);
  }
  dispose(): void { this.impact?.dispose(); this.air?.dispose(); this.experiment?.dispose(); }
}
