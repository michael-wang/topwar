import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';
import { SupplyCrateRenderer } from './SupplyCrateRenderer';
import { GrenadeExplosion } from './GrenadeExplosion';

export class GrenadeRenderer {
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly olive = new THREE.MeshStandardMaterial({ color: '#405A46', roughness: 1 });
  private readonly plaster = new THREE.MeshBasicMaterial({ color: '#F1EFE6' });
  private readonly flight = new THREE.Group();
  private readonly crate: SupplyCrateRenderer;
  private readonly explosion: GrenadeExplosion;
  constructor(private readonly scene: THREE.Scene) {
    this.crate = new SupplyCrateRenderer(scene); this.explosion = new GrenadeExplosion(scene);
    const body = new THREE.Mesh(this.sphere, this.olive); body.scale.set(.2, .27, .19);
    const lever = new THREE.Mesh(this.box, this.plaster); lever.scale.set(.11, .13, .12); lever.position.y = .26;
    this.flight.add(body, lever); this.flight.name = 'grenade-flight'; scene.add(this.flight); this.reset();
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
    burst: this.explosion.active > 0, dustCapacity: 16, explosionSlots: 2, activeExplosions: this.explosion.active }; }
  reset(): void { this.crate.reset(); this.explosion.reset(); this.flight.visible = false; }
  dispose(): void {
    this.crate.dispose(); this.explosion.dispose(); this.scene.remove(this.flight);
    for (const resource of [this.sphere, this.box, this.olive, this.plaster]) resource.dispose();
  }
}
