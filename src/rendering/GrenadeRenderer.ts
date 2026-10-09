import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';
import { SupplyCrateRenderer } from './SupplyCrateRenderer';
import { GrenadeExplosion } from './GrenadeExplosion';
import { GOLDEN_GRENADE } from '../art/GoldenGrenade';

export class GrenadeRenderer {
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly gold = new THREE.MeshStandardMaterial({ color: GOLDEN_GRENADE.gold, roughness: .35, metalness: .35 });
  private readonly bronze = new THREE.MeshStandardMaterial({ color: GOLDEN_GRENADE.bronze, roughness: .6 });
  private readonly orange = new THREE.MeshBasicMaterial({ color: GOLDEN_GRENADE.orange });
  private readonly plaster = new THREE.MeshBasicMaterial({ color: GOLDEN_GRENADE.reflection });
  private readonly flight = new THREE.Group();
  private readonly crate: SupplyCrateRenderer;
  private readonly explosion: GrenadeExplosion;
  constructor(private readonly scene: THREE.Scene) {
    this.crate = new SupplyCrateRenderer(scene); this.explosion = new GrenadeExplosion(scene);
    const body = new THREE.Mesh(this.sphere, this.gold); body.scale.set(.2, .27, .19);
    const lever = new THREE.Mesh(this.box, this.plaster); lever.scale.set(.11, .13, .12); lever.position.y = .26;
    const band = new THREE.Mesh(this.box,this.bronze); band.scale.set(.35,.035,.35);
    const gleam = new THREE.Mesh(this.sphere,this.plaster); gleam.scale.set(.035,.09,.025); gleam.position.set(-.08,.1,-.16);
    const lower = new THREE.Mesh(this.sphere,this.orange); lower.scale.set(.16,.11,.15); lower.position.y=-.16;
    this.flight.add(body, lever,band,gleam,lower); this.flight.name = 'grenade-flight'; scene.add(this.flight); this.reset();
  }
  present(events: readonly GrenadeEvent[], nowMs: number): void {
    this.crate.present(events, nowMs);
    for (const event of events) if (event.kind === 'grenadeDetonated') this.explosion.present(event.x, event.z, event.radius, nowMs);
  }
  update(state: GameRenderState['grenade'], nowMs: number): void {
    this.crate.update(state, nowMs); this.explosion.update(nowMs, state?.originZ ?? 0);
    this.flight.visible = !!state?.flight;
    if (state?.flight) {
      const f = state.flight, t = Math.max(0, Math.min(1, (state.elapsedSeconds - f.startedAtSeconds) / f.flightSeconds));
      this.flight.position.set(-THREE.MathUtils.lerp(f.startX, f.targetX, t),
        .8 * (1 - t) + .2 * t + 4 * 3 * t * (1 - t),
        THREE.MathUtils.lerp(f.startZ, f.targetZ, t) - state.originZ);
      this.flight.rotation.x = t * Math.PI * 3;
    }
  }
  getDebugStats() { return { supply: this.crate.visible, flight: this.flight.visible,
    burst: this.explosion.active > 0, dustCapacity: 16, explosionSlots: 2, activeExplosions: this.explosion.active,
    activeScorches: this.explosion.activeScorches }; }
  reset(): void { this.crate.reset(); this.explosion.reset(); this.flight.visible = false; }
  dispose(): void {
    this.crate.dispose(); this.explosion.dispose(); this.scene.remove(this.flight);
    for (const resource of [this.sphere, this.box, this.gold,this.bronze,this.orange, this.plaster]) resource.dispose();
  }
}
