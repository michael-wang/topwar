import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';

// One supply, one flight and one fixed 16-instance burst. No per-kill resources.
export class GrenadeRenderer {
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly ringGeometry = new THREE.RingGeometry(.82, 1, 32);
  private readonly olive = new THREE.MeshStandardMaterial({ color: '#405A46', roughness: 1 });
  private readonly sea = new THREE.MeshStandardMaterial({ color: '#58C8C1', roughness: 1 });
  private readonly plaster = new THREE.MeshBasicMaterial({ color: '#F1EFE6' });
  private readonly flashMaterial = new THREE.MeshBasicMaterial({ color: '#FFE5AD', transparent: true, depthWrite: false });
  private readonly dustMaterial = new THREE.MeshBasicMaterial({ color: '#B9AA8C', transparent: true, depthWrite: false });
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#FFE5AD', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private readonly supply = new THREE.Group();
  private readonly flight = new THREE.Group();
  private readonly flash = new THREE.Mesh(this.sphere, this.flashMaterial);
  private readonly ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly dust = new THREE.InstancedMesh(this.sphere, this.dustMaterial, 16);
  private readonly transform = new THREE.Object3D();
  private burst: { x: number; z: number; radius: number; atMs: number } | null = null;

  constructor(private readonly scene: THREE.Scene) {
    const crate = new THREE.Mesh(this.box, this.sea); crate.scale.set(1.05, .8, .65);
    const lid = new THREE.Mesh(this.box, this.plaster); lid.scale.set(1.15, .13, .75); lid.position.y = .44;
    const badge = this.makeGrenade(); badge.position.set(0, .02, -.42); badge.scale.setScalar(1.5);
    this.supply.add(crate, lid, badge);
    this.flight.add(this.makeGrenade());
    this.supply.name = 'grenade-supply'; this.flight.name = 'grenade-flight';
    this.flash.name = 'grenade-flash'; this.dust.name = 'grenade-dust';
    this.ring.name = 'grenade-shock-ring'; this.ring.rotation.x = -Math.PI / 2;
    this.dust.frustumCulled = false;
    scene.add(this.supply, this.flight, this.flash, this.dust, this.ring); this.reset();
  }
  private makeGrenade(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.sphere, this.olive); body.scale.set(.2, .27, .19);
    const lever = new THREE.Mesh(this.box, this.plaster); lever.scale.set(.11, .13, .12); lever.position.y = .26;
    group.add(body, lever); return group;
  }
  present(events: readonly GrenadeEvent[], nowMs: number): void {
    for (const event of events) if (event.kind === 'grenadeDetonated')
      this.burst = { x: event.x, z: event.z, radius: event.radius, atMs: nowMs };
  }
  update(state: GameRenderState['grenade'], nowMs: number): void {
    this.supply.visible = !!state?.supply;
    if (state?.supply) {
      this.supply.position.set(-state.supply.x, .9 + .07 * Math.sin(nowMs / 220), state.supply.depth);
      this.supply.rotation.y = .12 * Math.sin(nowMs / 600);
    }
    this.flight.visible = !!state?.flight;
    if (state?.flight) {
      const f = state.flight, t = Math.max(0, Math.min(1, (state.elapsedSeconds - f.startedAtSeconds) / f.flightSeconds));
      this.flight.position.set(-THREE.MathUtils.lerp(f.startX, f.targetX, t),
        .8 * (1 - t) + .2 * t + 4 * 3 * t * (1 - t),
        THREE.MathUtils.lerp(f.startZ, f.targetZ, t) - state.originZ);
      this.flight.rotation.x = t * Math.PI * 3;
    }
    const age = this.burst ? (nowMs - this.burst.atMs) / 800 : 2;
    this.flash.visible = age >= 0 && age < .22;
    this.dust.visible = age >= 0 && age < 1;
    this.ring.visible = age >= 0 && age < .6;
    if (!this.burst || age >= 1) { this.burst = null; return; }
    const z = this.burst.z - (state?.originZ ?? 0);
    this.flash.position.set(-this.burst.x, .65, z);
    this.flash.scale.setScalar(this.burst.radius * (.3 + age * 4));
    this.flashMaterial.opacity = Math.max(0, .8 * (1 - age / .22));
    this.ring.position.set(-this.burst.x, .06, z);
    this.ring.scale.setScalar(this.burst.radius * (.3 + Math.min(1, age / .6) * .7));
    this.ringMaterial.opacity = Math.max(0, .7 * (1 - age / .6));
    this.dustMaterial.opacity = .48 * (1 - age);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16, distance = this.burst.radius * (.15 + age * .8);
      this.transform.position.set(-this.burst.x + Math.cos(angle) * distance,
        .2 + age * (.5 + (i % 3) * .15), z + Math.sin(angle) * distance);
      this.transform.scale.setScalar(.12 + age * (.3 + (i % 3) * .06));
      this.transform.updateMatrix(); this.dust.setMatrixAt(i, this.transform.matrix);
    }
    this.dust.instanceMatrix.needsUpdate = true;
  }
  getDebugStats() { return { supply: this.supply.visible, flight: this.flight.visible,
    burst: this.burst !== null, dustCapacity: 16 }; }
  reset(): void { this.burst = null; this.supply.visible = this.flight.visible = this.flash.visible = this.dust.visible = this.ring.visible = false; }
  dispose(): void {
    this.scene.remove(this.supply, this.flight, this.flash, this.dust, this.ring); this.dust.dispose();
    for (const resource of [this.sphere, this.box, this.ringGeometry, this.olive, this.sea, this.plaster, this.flashMaterial, this.dustMaterial, this.ringMaterial]) resource.dispose();
  }
}
