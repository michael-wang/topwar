import * as THREE from 'three';
import { GRENADE_FX } from '../presentation/GrenadeMotion';

// Two reusable slots cover the accepted 0.65s flight cadence and 1.2s tail.
export class GrenadeExplosion {
  private readonly sphere = new THREE.SphereGeometry(1, 9, 6);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly ringGeometry = new THREE.RingGeometry(.86, 1, 40);
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly slots: ReturnType<GrenadeExplosion['createSlot']>[] = [];
  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < GRENADE_FX.slots; i++) this.slots.push(this.createSlot(i));
    this.reset();
  }
  private createSlot(index: number) {
    const coreMat = new THREE.MeshBasicMaterial({ color: '#fff1bb', transparent: true, depthWrite: false });
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff6320', transparent: true, depthWrite: false });
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#56524b', transparent: true, depthWrite: false });
    const dustMat = new THREE.MeshBasicMaterial({ color: '#bcaa84', transparent: true, depthWrite: false });
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd384', transparent: true, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd6a0', transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const core = new THREE.Mesh(this.sphere, coreMat), fire = new THREE.InstancedMesh(this.sphere, fireMat, 7);
    const smoke = new THREE.InstancedMesh(this.sphere, smokeMat, 10), dust = new THREE.InstancedMesh(this.sphere, dustMat, 16);
    const sparks = new THREE.InstancedMesh(this.box, sparkMat, 12), ring = new THREE.Mesh(this.ringGeometry, ringMat);
    // The compact hot core must remain visible inside the overlapping fire lobes.
    fire.renderOrder = 1; core.renderOrder = 2;
    const meshes = [core, fire, smoke, dust, sparks, ring];
    for (const [i, mesh] of meshes.entries()) {
      mesh.name = ['grenade-flash', 'grenade-fire', 'grenade-smoke', 'grenade-dust', 'grenade-sparks', 'grenade-shock-ring'][i] + (index ? `-${index}` : '');
      mesh.frustumCulled = false;
      if (mesh instanceof THREE.InstancedMesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    ring.rotation.x = -Math.PI / 2; this.scene.add(...meshes);
    return { atMs: -Infinity, x: 0, z: 0, radius: 4, meshes, core, fire, smoke, dust, sparks, ring,
      materials: [coreMat, fireMat, smokeMat, dustMat, sparkMat, ringMat] };
  }
  present(x: number, z: number, radius: number, nowMs: number): void {
    const slot = this.slots.find(s => nowMs - s.atMs >= GRENADE_FX.durationMs)
      ?? this.slots.reduce((a, b) => a.atMs < b.atMs ? a : b);
    Object.assign(slot, { atMs: nowMs, x, z, radius });
  }
  update(nowMs: number, originZ: number): void {
    for (const s of this.slots) {
      const age = nowMs - s.atMs, t = age / 1000, r = s.radius, x = -s.x, z = s.z - originZ;
      const active = age >= 0 && age < GRENADE_FX.durationMs;
      s.meshes.forEach(m => { m.visible = active; }); if (!active) continue;
      s.core.visible = t < .12; s.fire.visible = t < .38; s.smoke.visible = t >= .20;
      s.dust.visible = t >= .08 && t < .8; s.sparks.visible = t < .65; s.ring.visible = t >= .08 && t < .36;
      s.core.position.set(x, .6, z); s.core.scale.setScalar(r * (.1 + Math.min(t, .12) * .8));
      s.materials[0].opacity = Math.max(0, 1 - t / .12);
      s.materials[1].opacity = Math.max(0, 1 - Math.max(0, t - .12) / .26);
      s.materials[2].opacity = Math.max(0, Math.min(1, (t - .2) / .15)) * .55 * Math.max(0, (1.2 - t) / .85);
      s.materials[2].color.set(t < .35 ? '#895437' : '#56524b');
      s.materials[3].opacity = .4 * Math.max(0, 1 - t / .8);
      s.materials[4].opacity = Math.max(0, 1 - t / .65);
      s.materials[5].opacity = .7 * Math.max(0, 1 - Math.max(0, t - .12) / .24);
      s.ring.position.set(x, .065, z); s.ring.scale.setScalar(r * Math.min(1, t / .35));
      for (let i = 0; i < 16; i++) {
        const angle = i * 2.399963229728653, dx = Math.cos(angle), dz = Math.sin(angle);
        if (i < 7) {
          const grow = Math.min(1, t / .13), distance = r * .25 * grow;
          this.transform.position.set(x + dx * distance, .45 + (i % 3) * .27 + t * 1.3, z + dz * distance);
          this.transform.rotation.set(i, angle, 0); this.transform.scale.setScalar(r * (.13 + .15 * grow) * (i % 2 ? .8 : 1));
          this.transform.updateMatrix(); s.fire.setMatrixAt(i, this.transform.matrix);
          s.fire.setColorAt(i, this.color.set(i % 3 === 0 ? '#ffe299' : i % 3 === 1 ? '#ffac3d' : '#ee4820'));
        }
        if (i < 10) {
          const grow = Math.max(0, t - .2), distance = r * (.14 + grow * .24);
          this.transform.position.set(x + dx * distance, .5 + i % 3 * .35 + grow * (1.1 + i % 2 * .6), z + dz * distance);
          this.transform.rotation.set(0, angle, 0); this.transform.scale.setScalar(r * (.12 + grow * .19));
          this.transform.updateMatrix(); s.smoke.setMatrixAt(i, this.transform.matrix);
        }
        const distance = r * (.18 + Math.min(t, .65) * 1.35);
        this.transform.position.set(x + dx * distance, .1 + Math.sin(Math.min(1, t / .8) * Math.PI) * .35, z + dz * distance);
        this.transform.rotation.set(0, angle, 0); this.transform.scale.set(r * (.05 + t * .12), .12 + t * .2, r * (.08 + t * .12));
        this.transform.updateMatrix(); s.dust.setMatrixAt(i, this.transform.matrix);
        if (i < 12) {
          this.transform.position.set(x + dx * r * t * 1.5, Math.max(.09, .4 + (2.5 + i % 3) * t - 6 * t * t), z + dz * r * t * 1.5);
          this.transform.rotation.set(t * 8 + i, angle, t * 5); this.transform.scale.set(.045, .12 + i % 3 * .035, .05);
          this.transform.updateMatrix(); s.sparks.setMatrixAt(i, this.transform.matrix);
        }
      }
      for (const mesh of [s.fire, s.smoke, s.dust, s.sparks]) mesh.instanceMatrix.needsUpdate = true;
      if (s.fire.instanceColor) s.fire.instanceColor.needsUpdate = true;
    }
  }
  get active(): number { return this.slots.filter(s => s.meshes.some(m => m.visible)).length; }
  reset(): void { for (const s of this.slots) { s.atMs = -Infinity; s.meshes.forEach(m => { m.visible = false; }); } }
  dispose(): void {
    for (const s of this.slots) { this.scene.remove(...s.meshes); for (const m of s.meshes) if (m instanceof THREE.InstancedMesh) m.dispose(); s.materials.forEach(m => m.dispose()); }
    this.sphere.dispose(); this.box.dispose(); this.ringGeometry.dispose();
  }
}
