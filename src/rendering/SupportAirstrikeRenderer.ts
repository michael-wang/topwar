import * as THREE from 'three';
import { GrenadeExplosion } from './GrenadeExplosion';
import type { SupportEvent } from '../simulation/commanderSupport';

/** One short flyover and four reused blast slots; no ambient scheduler. */
export class SupportAirstrikeRenderer {
  readonly plane = new THREE.Group();
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly metal = new THREE.MeshBasicMaterial({ color: '#293447' });
  private readonly explosions: GrenadeExplosion;
  private flyoverAt = -Infinity;
  private impactAt = -Infinity;
  constructor(private readonly scene: THREE.Scene) {
    this.explosions = new GrenadeExplosion(scene, 4, false);
    for (const [x, y, z, w, h, d] of [[0, 0, 0, .55, .3, 3.6], [0, 0, .2, 4.8, .13, .9], [0, .1, -1.5, 1.8, .12, .5]]) {
      const mesh = new THREE.Mesh(this.box, this.metal); mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      this.plane.add(mesh);
    }
    this.plane.name = 'commander-support-aircraft'; this.plane.visible = false; scene.add(this.plane);
  }
  present(events: readonly SupportEvent[], now: number): void {
    for (const event of events) {
      if (event.kind === 'supportFlyover') this.flyoverAt = now;
      else {
        this.impactAt = now;
        for (const blast of event.blasts) this.explosions.present(blast.x, blast.z, 2.8, now);
      }
    }
  }
  update(now: number, originZ: number, ended: boolean): number {
    if (ended) this.flyoverAt = -Infinity;
    const t = (now - this.flyoverAt) / 1100;
    this.plane.visible = t >= 0 && t < 1;
    if (this.plane.visible) {
      this.plane.position.set(17 - t * 34, 6.7, 18 - t * 7 - originZ);
      this.plane.rotation.set(0, -Math.PI / 2, -.15);
    }
    this.explosions.update(now, originZ);
    const age = now - this.impactAt;
    return !ended && age >= 0 && age < 220 ? Math.sin(age / 18) * .055 * (1 - age / 220) : 0;
  }
  reset(): void { this.flyoverAt = this.impactAt = -Infinity; this.plane.visible = false; this.explosions.reset(); }
  dispose(): void { this.explosions.dispose(); this.scene.remove(this.plane); this.box.dispose(); this.metal.dispose(); }
}
