import * as THREE from 'three';
import {EXPLOSION_SMOKE, explosionSmokeGeometry, prepareExplosionSmoke, poseExplosionSmoke, explosionSmokeOpacity} from './ExplosionSmoke';
const SMOKE = EXPLOSION_SMOKE.airstrike;

const AIRSTRIKE_FX = { slots: 9, durationMs: SMOKE.seconds * 1000, radius: 4.8 } as const;
/** Nine reusable impacts: solid fire lobes and twenty layered smoke puffs, no per-victim objects. */
export class HeavyAirstrikeExplosion {
  private readonly sphere = new THREE.SphereGeometry(1, 9, 6);
  private readonly smokeSphere = explosionSmokeGeometry(this.sphere, SMOKE);
  private readonly ring = new THREE.RingGeometry(.82, 1, 32);
  private readonly pose = new THREE.Object3D();
  private readonly slots: ReturnType<HeavyAirstrikeExplosion['slot']>[] = [];
  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < AIRSTRIKE_FX.slots; i++) this.slots.push(this.slot(i));
  }
  private slot(index: number) {
    const mats = [
      new THREE.MeshBasicMaterial({ color: '#fff5d1', transparent: true, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: '#f95f13', transparent: true, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: '#9f8767', transparent: true, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: '#ffc271', transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ];
    const core = new THREE.Mesh(this.sphere, mats[0]), fire = new THREE.InstancedMesh(this.sphere, mats[1], 5),
      smoke = new THREE.InstancedMesh(this.smokeSphere, mats[2], SMOKE.count), dust = new THREE.InstancedMesh(this.sphere, mats[3], 10),
      shock = new THREE.Mesh(this.ring, mats[4]);
    const smokeAge = prepareExplosionSmoke(smoke, SMOKE);
    const meshes = [core, fire, smoke, dust, shock];
    for (const m of meshes) { m.name = `airstrike-${index}-${m === core ? 'core' : m === fire ? 'fire' : m === smoke ? 'smoke' : m === dust ? 'dust' : 'shockwave'}`; m.visible = false; m.frustumCulled = false; }
    for (const m of [fire, smoke, dust]) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 5; i++) fire.setColorAt(i, new THREE.Color(i % 2 ? '#ff941c' : '#f44e10'));
    core.renderOrder = 3; fire.renderOrder = 2; shock.rotation.x = -Math.PI / 2;
    this.scene.add(...meshes);
    return { at: -Infinity, x: 0, z: 0, mats, meshes, core, fire, smoke, dust, shock, smokeAge };
  }
  present(index: number, x: number, z: number, at: number): void { Object.assign(this.slots[index % AIRSTRIKE_FX.slots], { x, z, at }); }
  update(now: number, originZ: number): void {
    const durationSeconds = AIRSTRIKE_FX.durationMs / 1000;
    for (const s of this.slots) {
      const t = (now - s.at) / 1000, r = AIRSTRIKE_FX.radius, x = -s.x, z = s.z - originZ;
      for (const m of s.meshes) m.visible = t >= 0 && t < durationSeconds;
      if (t < 0 || t >= durationSeconds) continue;
      s.core.visible = t < .28; s.fire.visible = t < .65; s.dust.visible = t < 1.4; s.shock.visible = t < .6;
      s.core.position.set(x, 2.5, z); s.core.scale.setScalar(r * (.22 + .32 * Math.min(1, t / .18)));
      s.mats[0].opacity = Math.max(0, 1 - t / .28); s.mats[1].opacity = Math.max(0, 1 - t/.65);
      s.smokeAge.value = t;
      s.mats[2].opacity = explosionSmokeOpacity(t, SMOKE);
      s.mats[3].opacity = .45 * Math.max(0, 1 - t / 1.4); s.mats[4].opacity = .85 * Math.max(0, 1 - t / .6);
      s.shock.position.set(x, .1, z); s.shock.scale.setScalar(r * (1 + t * 2.3));
      for (let i = 0; i < 10; i++) {
        const a = i * 2.399963, dx = Math.cos(a), dz = Math.sin(a);
        if (i < 5) {
          const g = Math.min(1, t / .22);
          this.pose.position.set(x + dx * r * .27 * g, 1.5 + i % 2 * .5 + t * 2, z + dz * r * .25 * g);
          this.pose.scale.setScalar(r * (.20 + .13 * g)); this.pose.rotation.set(i, a, 0); this.pose.updateMatrix(); s.fire.setMatrixAt(i, this.pose.matrix);
        }
        this.pose.position.set(x + dx * r * Math.min(1.5, .2 + t), .2 + t * .18, z + dz * r * Math.min(1.5, .2 + t));
        this.pose.scale.set(.55 + t * .5, .22 + t * .3, .7 + t * .5); this.pose.rotation.set(0, a, 0); this.pose.updateMatrix(); s.dust.setMatrixAt(i, this.pose.matrix);
      }
      for(let i=0;i<SMOKE.count;i++) {
        poseExplosionSmoke(this.pose,i,i<SMOKE.dark,t,r,x,z);
        s.smoke.setMatrixAt(i,this.pose.matrix);
      }
      for (const m of [s.fire, s.smoke, s.dust]) m.instanceMatrix.needsUpdate = true;
    }
  }
  reset(): void { for (const s of this.slots) { s.at = -Infinity; s.meshes.forEach(m => m.visible = false); } }
  dispose(): void {
    for (const s of this.slots) { this.scene.remove(...s.meshes); for (const m of [s.fire, s.smoke, s.dust]) m.dispose(); s.mats.forEach(m => m.dispose()); }
    this.sphere.dispose(); this.smokeSphere.dispose(); this.ring.dispose();
  }
}
