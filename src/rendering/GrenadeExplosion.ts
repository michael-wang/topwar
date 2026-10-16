import * as THREE from 'three';
import { GRENADE_FX, GRENADE_DEBRIS_COUNT, grenadeDebrisPose } from '../presentation/GrenadeMotion';
import { GroundScorchMarks } from './GroundScorchMarks';
import {EXPLOSION_SMOKE, explosionSmokeGeometry, prepareExplosionSmoke, poseExplosionSmoke, explosionSmokeOpacity, smokeIsDark} from './ExplosionSmoke';

// Three reusable grenade slots cover the 0.65s flight cadence and 1.9s smoke tail.
export class GrenadeExplosion {
  private readonly sphere = new THREE.SphereGeometry(1, 9, 6);
  private readonly smokeSphere: THREE.SphereGeometry;
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly ringGeometry = new THREE.RingGeometry(.86, 1, 40);
  private readonly transform = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly slots: ReturnType<GrenadeExplosion['createSlot']>[] = [];
  private readonly scorch: GroundScorchMarks | null;
  constructor(private readonly scene: THREE.Scene, slots: number = GRENADE_FX.slots, persistentScorch = true, private readonly smokeTier: 'grenade' | 'artillery' = 'grenade') {
    if (!Number.isInteger(slots) || slots < 1 || slots > 8) throw Error('Invalid explosion pool capacity');
    this.smokeSphere = explosionSmokeGeometry(this.sphere, EXPLOSION_SMOKE[smokeTier]);
    this.scorch = persistentScorch ? new GroundScorchMarks(scene) : null;
    for (let i = 0; i < slots; i++) this.slots.push(this.createSlot(i));
    this.reset();
  }
  private createSlot(index: number) {
    const coreMat = new THREE.MeshBasicMaterial({ color: '#fff1bb', transparent: true, depthWrite: false });
    const fireMat = new THREE.MeshBasicMaterial({ color: '#ff6320', transparent: true, depthWrite: false });
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
    const dustMat = new THREE.MeshBasicMaterial({ color: '#bcaa84', transparent: true, depthWrite: false });
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd384', transparent: true, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd6a0', transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const debrisMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
    const core = new THREE.Mesh(this.sphere, coreMat), fire = new THREE.InstancedMesh(this.sphere, fireMat, 7);
    const smoke = new THREE.InstancedMesh(this.smokeSphere, smokeMat, EXPLOSION_SMOKE[this.smokeTier].count), dust = new THREE.InstancedMesh(this.sphere, dustMat, 16);
    const sparks = new THREE.InstancedMesh(this.box, sparkMat, 12), ring = new THREE.Mesh(this.ringGeometry, ringMat);
    const debris = new THREE.InstancedMesh(this.box, debrisMat, GRENADE_DEBRIS_COUNT);
    // The first render needs the same instancing-color shader as idle preparation.
    for (let i = 0; i < 7; i++) fire.setColorAt(i, this.color.set(i % 3 === 0 ? '#ffe299' : i % 3 === 1 ? '#ffac3d' : '#ee4820'));
    const smokeAge = prepareExplosionSmoke(smoke, EXPLOSION_SMOKE[this.smokeTier]);
    for (let i = 0; i < GRENADE_DEBRIS_COUNT; i++) debris.setColorAt(i, this.color.set(['#666563', '#8a8273', '#aaa18e', '#777975'][i % 4]));
    // The compact hot core must remain visible inside the overlapping fire lobes.
    fire.renderOrder = 1; core.renderOrder = 2;
    const meshes = [core, fire, smoke, dust, sparks, ring, debris];
    for (const [i, mesh] of meshes.entries()) {
      mesh.name = ['grenade-flash', 'grenade-fire', 'grenade-smoke', 'grenade-dust', 'grenade-sparks', 'grenade-shock-ring', 'grenade-debris'][i] + (index ? `-${index}` : '');
      mesh.frustumCulled = false;
      if (mesh instanceof THREE.InstancedMesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    ring.rotation.x = -Math.PI / 2; this.scene.add(...meshes);
    return { atMs: -Infinity, x: 0, z: 0, radius: 4, meshes, core, fire, smoke, dust, sparks, ring, debris,
      smokeAge, materials: [coreMat, fireMat, smokeMat, dustMat, sparkMat, ringMat, debrisMat] };
  }
  present(x: number, z: number, radius: number, nowMs: number): void {
    const slot = this.slots.find(s => nowMs - s.atMs >= EXPLOSION_SMOKE[this.smokeTier].seconds * 1000)
      ?? this.slots.reduce((a, b) => a.atMs < b.atMs ? a : b);
    Object.assign(slot, { atMs: nowMs, x, z, radius });
    this.scorch?.present(x, z, radius, nowMs);
  }
  update(nowMs: number, originZ: number): void {
    this.scorch?.update(nowMs, originZ);
    for (const s of this.slots) {
      const age = nowMs - s.atMs, t = age / 1000, r = s.radius, x = -s.x, z = s.z - originZ;
      const active = age >= 0 && age < EXPLOSION_SMOKE[this.smokeTier].seconds * 1000;
      s.meshes.forEach(m => { m.visible = active; }); if (!active) continue;
      s.core.visible = t < .12; s.fire.visible = t < .28; s.smoke.visible = this.smokeTier === 'artillery' || t >= .08;
      // Artillery reuses the plume pool, not grenade shrapnel or yellow box sparks.
      s.debris.visible = this.smokeTier === 'grenade' && age < GRENADE_FX.durationMs;
      s.dust.visible = t >= .08 && t < .8; s.sparks.visible = this.smokeTier === 'grenade' && t < .65; s.ring.visible = t >= .08 && t < .36;
      const burstRadius = this.smokeTier === 'artillery' ? Math.max(1.8, r) : r;
      s.core.position.set(x, .6, z); s.core.scale.setScalar(burstRadius * (.1 + Math.min(t, .12) * .8));
      s.materials[0].opacity = Math.max(0, 1 - t / .12);
      s.materials[1].opacity = Math.max(0, 1 - Math.max(0, t - .12) / .16);
      s.smokeAge.value = t;
      s.materials[2].opacity = explosionSmokeOpacity(t, EXPLOSION_SMOKE[this.smokeTier]);
      s.materials[3].opacity = .4 * Math.max(0, 1 - t / .8);
      s.materials[4].opacity = Math.max(0, 1 - t / .65);
      s.materials[5].opacity = .7 * Math.max(0, 1 - Math.max(0, t - .12) / .24);
      s.materials[6].opacity = Math.min(1, (1.2 - t) / .4);
      for (let i = 0; s.debris.visible && i < GRENADE_DEBRIS_COUNT; i++) {
        const p = grenadeDebrisPose(i, age, r), size = .14 + i % 3 * .05;
        this.transform.position.set(x + p.x, p.y, z + p.z);
        this.transform.rotation.set(p.spin, i, p.spin * .6); this.transform.scale.set(size, size * .65, size * 1.7);
        this.transform.updateMatrix(); s.debris.setMatrixAt(i, this.transform.matrix);
      }
      s.debris.instanceMatrix.needsUpdate = true;
      s.ring.position.set(x, .065, z); s.ring.scale.setScalar(r * Math.min(1, t / .35));
      for (let i = 0; i < 16; i++) {
        const angle = i * 2.399963229728653, dx = Math.cos(angle), dz = Math.sin(angle);
        if (i < 7 && s.fire.visible) {
          const grow = Math.min(1, t / .13), distance = burstRadius * .25 * grow;
          this.transform.position.set(x + dx * distance, .45 + (i % 3) * .27 + t * 1.3, z + dz * distance);
          this.transform.rotation.set(i, angle, 0); this.transform.scale.setScalar(burstRadius * (.11 + .12 * grow) * (i % 2 ? .8 : 1));
          this.transform.updateMatrix(); s.fire.setMatrixAt(i, this.transform.matrix);
        }
        const distance = r * (.18 + Math.min(t, .65) * 1.35);
        this.transform.position.set(x + dx * distance, .1 + Math.sin(Math.min(1, t / .8) * Math.PI) * .35, z + dz * distance);
        this.transform.rotation.set(0, angle, 0); this.transform.scale.set(r * (.05 + t * .12), .12 + t * .2, r * (.08 + t * .12));
        this.transform.updateMatrix(); s.dust.setMatrixAt(i, this.transform.matrix);
        if (i < 12 && s.sparks.visible) {
          this.transform.position.set(x + dx * r * t * 1.5, Math.max(.09, .4 + (2.5 + i % 3) * t - 6 * t * t), z + dz * r * t * 1.5);
          this.transform.rotation.set(t * 8 + i, angle, t * 5); this.transform.scale.set(.045, .12 + i % 3 * .035, .05);
          this.transform.updateMatrix(); s.sparks.setMatrixAt(i, this.transform.matrix);
        }
      }
      const profile = EXPLOSION_SMOKE[this.smokeTier];
      // Tiny artillery damage radii must not shrink the post-blast visual plume.
      const smokeRadius = this.smokeTier === 'artillery' ? Math.max(3.6, r) : r;
      for(let i=0;i<profile.count;i++) {
        // Fire and both smoke layers start together, then the complete plume catches the wind.
        const smokeAge=this.smokeTier === 'artillery'?Math.max(0,t-.12):t;
        poseExplosionSmoke(this.transform,i,smokeIsDark(i,profile),smokeAge,smokeRadius,x,z,profile);
        s.smoke.setMatrixAt(i,this.transform.matrix);
      }
      for (const mesh of [s.fire, s.smoke, s.dust, s.sparks]) mesh.instanceMatrix.needsUpdate = true;
    }
  }
  get active(): number { return this.slots.filter(s => s.meshes.some(m => m.visible)).length; }
  get activeScorches(): number { return this.scorch?.active ?? 0; }
  reset(): void { this.scorch?.reset(); for (const s of this.slots) { s.atMs = -Infinity; s.meshes.forEach(m => { m.visible = false; }); } }
  dispose(): void {
    this.scorch?.dispose();
    for (const s of this.slots) { this.scene.remove(...s.meshes); for (const m of s.meshes) if (m instanceof THREE.InstancedMesh) m.dispose(); s.materials.forEach(m => m.dispose()); }
    this.sphere.dispose(); this.smokeSphere.dispose(); this.box.dispose(); this.ringGeometry.dispose();
  }
}
