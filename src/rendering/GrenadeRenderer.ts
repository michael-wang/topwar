import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';
import { SupplyCrateRenderer } from './SupplyCrateRenderer';
import { GrenadeExplosion } from './GrenadeExplosion';
import { GRENADE_FX } from '../presentation/GrenadeMotion';
import { GOLDEN_GRENADE } from '../art/GoldenGrenade';

export class GrenadeRenderer {
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly gold = new THREE.MeshStandardMaterial({ color: GOLDEN_GRENADE.gold, roughness: .35, metalness: .35,
    emissive: GOLDEN_GRENADE.amber, emissiveIntensity: .35 });
  private readonly bronze = new THREE.MeshStandardMaterial({ color: GOLDEN_GRENADE.bronze, roughness: .6 });
  private readonly orange = new THREE.MeshBasicMaterial({ color: GOLDEN_GRENADE.orange });
  private readonly plaster = new THREE.MeshBasicMaterial({ color: GOLDEN_GRENADE.reflection });
  private readonly flight = new THREE.Group();
  private readonly trailGeometry = new THREE.BufferGeometry();
  private readonly trail = new THREE.Mesh(this.trailGeometry, this.orange);
  private readonly trailPositions = new THREE.BufferAttribute(new Float32Array(7 * 8 * 3), 3);
  private readonly trailRadials = new Float32Array(16);
  private readonly trailPoint = new THREE.Vector3();
  private readonly trailDirection = new THREE.Vector3();
  private readonly trailRight = new THREE.Vector3();
  private readonly trailUp = new THREE.Vector3();
  private readonly vertical = new THREE.Vector3(0, 1, 0);
  private readonly crate: SupplyCrateRenderer;
  private readonly explosion: GrenadeExplosion;
  constructor(private readonly scene: THREE.Scene) {
    this.crate = new SupplyCrateRenderer(scene); this.explosion = new GrenadeExplosion(scene);
    const body = new THREE.Mesh(this.sphere, this.gold); body.scale.set(.2, .27, .19);
    const lever = new THREE.Mesh(this.box, this.plaster); lever.scale.set(.11, .13, .12); lever.position.y = .26;
    const band = new THREE.Mesh(this.box,this.bronze); band.scale.set(.35,.035,.35);
    const gleam = new THREE.Mesh(this.sphere,this.plaster); gleam.scale.set(.035,.09,.025); gleam.position.set(-.08,.1,-.16);
    const lower = new THREE.Mesh(this.sphere,this.orange); lower.scale.set(.16,.11,.15); lower.position.y=-.16;
    this.flight.add(body, lever,band,gleam,lower); this.flight.scale.setScalar(1.75);
    this.flight.name = 'grenade-flight'; this.trail.name = 'grenade-gold-trail'; this.trail.frustumCulled = false;
    this.trailPositions.setUsage(THREE.DynamicDrawUsage);
    this.trailGeometry.setAttribute('position', this.trailPositions);
    const indices: number[] = [];
    for (let ring = 0; ring < 6; ring++) for (let side = 0; side < 8; side++) {
      const a = ring * 8 + side, b = ring * 8 + (side + 1) % 8;
      indices.push(a, b, a + 8, a + 8, b, b + 8);
    }
    this.trailGeometry.setIndex(indices);
    for (let side = 0; side < 8; side++) {
      this.trailRadials[side * 2] = Math.cos(side * Math.PI / 4);
      this.trailRadials[side * 2 + 1] = Math.sin(side * Math.PI / 4);
    }
    scene.add(this.flight, this.trail); this.reset();
  }
  present(events: readonly GrenadeEvent[], nowMs: number): void {
    this.crate.present(events, nowMs);
    for (const event of events) if (event.kind === 'grenadeDetonated') this.explosion.present(event.x, event.z, event.radius, nowMs);
  }
  update(state: GameRenderState['grenade'], nowMs: number): void {
    this.crate.update(state, nowMs); this.explosion.update(nowMs, state?.originZ ?? 0);
    this.flight.visible = !!state?.flight;
    this.trail.visible = this.flight.visible;
    if (state?.flight) {
      const f = state.flight, t = Math.max(0, Math.min(1, (state.elapsedSeconds - f.startedAtSeconds) / f.flightSeconds));
      this.arcPoint(f, t, state.originZ, this.flight.position);
      this.flight.rotation.x = t * Math.PI * 3;
      // A short, tapered analytic tail always lies behind the authoritative shot.
      // One fixed tube shares the existing non-instanced basic-material program.
      // Its seven rings/vectors are reused; no trails or shader variants accumulate.
      const span = Math.min(t, .16, 2.2 / Math.max(1, Math.hypot(f.targetX - f.startX, f.targetZ - f.startZ)));
      this.trail.visible = span > 0;
      for (let ring = 0; ring < 7; ring++) {
        const sampleT = t - span * ring / 6;
        this.arcPoint(f, sampleT, state.originZ, this.trailPoint);
        this.trailDirection.set(f.startX - f.targetX, -.6 + 12 * (1 - 2 * sampleT), f.targetZ - f.startZ).normalize();
        this.trailRight.crossVectors(this.trailDirection, this.vertical);
        if (this.trailRight.lengthSq() < 1e-9) this.trailRight.set(1, 0, 0);
        else this.trailRight.normalize();
        this.trailUp.crossVectors(this.trailRight, this.trailDirection).normalize();
        const width = .11 * (1 - ring / 6);
        for (let side = 0; side < 8; side++) {
          const x = this.trailRadials[side * 2] * width, y = this.trailRadials[side * 2 + 1] * width;
          this.trailPositions.setXYZ(ring * 8 + side, this.trailPoint.x + this.trailRight.x * x + this.trailUp.x * y,
            this.trailPoint.y + this.trailRight.y * x + this.trailUp.y * y, this.trailPoint.z + this.trailRight.z * x + this.trailUp.z * y);
        }
      }
      this.trailPositions.needsUpdate = true;
    }
  }
  private arcPoint(f: NonNullable<NonNullable<GameRenderState['grenade']>['flight']>, t: number, originZ: number, point: THREE.Vector3): void {
    point.set(-THREE.MathUtils.lerp(f.startX, f.targetX, t), .8 * (1 - t) + .2 * t + 12 * t * (1 - t),
      THREE.MathUtils.lerp(f.startZ, f.targetZ, t) - originZ);
  }
  getDebugStats() { return { supply: this.crate.visible, flight: this.flight.visible,
    burst: this.explosion.active > 0, dustCapacity: 16, explosionSlots: GRENADE_FX.slots, activeExplosions: this.explosion.active,
    activeScorches: this.explosion.activeScorches }; }
  preparationMeshes(): THREE.Mesh[] { return [...this.crate.preparationMeshes(), ...this.flight.children as THREE.Mesh[], this.trail]; }
  reset(): void { this.crate.reset(); this.explosion.reset(); this.flight.visible = false; this.trail.visible = false; }
  dispose(): void {
    this.crate.dispose(); this.explosion.dispose(); this.scene.remove(this.flight, this.trail); this.trailGeometry.dispose();
    for (const resource of [this.sphere, this.box, this.gold,this.bronze,this.orange, this.plaster]) resource.dispose();
  }
}
