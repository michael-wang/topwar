import type { GiantVisualFamily, CharacterModel } from '../CharacterVisualFamilies';
import { GIANT_REVEAL_MS, GIANT_DEATH_MS, GIANT_CRASH_MS, giantReveal, giantDeathPose } from '../../presentation/GiantDrama';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { giantWeightPose } from '../../presentation/CharacterMotion';
import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import type { HeavyHitFeedback } from './HeavyHitFeedback';

function hazeTexture(): THREE.DataTexture {
  const size = 32, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - 15.5) / 15.5, dy = (y - 15.5) / 15.5, radius = dx * dx + dy * dy;
    const at = (y * size + x) * 4; bytes[at] = bytes[at + 1] = bytes[at + 2] = 255;
    bytes[at + 3] = Math.round(180 * Math.pow(Math.max(0, 1 - radius), 1.5));
  }
  const texture = new THREE.DataTexture(bytes, size, size); texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; return texture;
}

// A bounded slot for each live or recently defeated Giant; all ornament/weapon motion is disposable presentation.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly red = new THREE.MeshStandardMaterial({ color: ART.faction.giant, roughness: .65,
    emissive: '#ffc16f', emissiveIntensity: 0 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: ART.faction.gold, roughness: .5,
    metalness: .1, emissive: '#fff0b9', emissiveIntensity: 0 });
  private readonly skin = new THREE.MeshStandardMaterial({ color: ART.faction.skin, roughness: .9 });
  private readonly steel = new THREE.MeshStandardMaterial({ color: ART.world.nearAccent, roughness: .6 });
  private readonly leather = new THREE.MeshStandardMaterial({ color: ART.faction.leather, roughness: .9 });
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterial: THREE.MeshStandardMaterial;
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly facet = new THREE.IcosahedronGeometry(1, 0);
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
  private readonly cone = new THREE.ConeGeometry(1, 1, 5);
  private readonly trim = new THREE.TorusGeometry(1, .08, 5, 12);
  private readonly body: THREE.Mesh;
  private readonly arms: THREE.Group[] = [];
  private readonly forearms: THREE.Group[] = [];
  private readonly shoulders: THREE.Mesh[] = [];
  private readonly weapon = new THREE.Group();
  private readonly palette: { material: THREE.MeshStandardMaterial; color: THREE.Color }[];
  private readonly dimensions: THREE.Vector3;
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: ART.fx.gold, transparent: true,
    opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private readonly ringGeometry = new THREE.RingGeometry(1, 1.2, 32);
  private readonly ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly hazeMap = hazeTexture();
  private readonly hazeMaterial = new THREE.SpriteMaterial({ map: this.hazeMap, color: ART.world.fog,
    transparent: true, opacity: 0, depthWrite: false });
  private readonly haze = new THREE.Group();
  private readonly chunksMaterial = new THREE.MeshStandardMaterial({ color: 'white', roughness: 1, transparent: true });
  private readonly debrisGroup = new THREE.Object3D();
  private readonly chunks = new THREE.InstancedMesh(this.facet, this.chunksMaterial, 12);
  private readonly transform = new THREE.Object3D();
  private readonly coreColor = new THREE.Color(ART.fx.core);
  private bornAt = -Infinity;
  private previous: EnemyRenderState | undefined;
  private deathAt = -Infinity;
  private readonly frames: readonly CharacterModel[];
  private readonly grayBody: CharacterModel;
  constructor(private readonly scene: THREE.Scene, family: GiantVisualFamily) {
    const { body, helmet, vest, runFrames: frames, grayBody } = family;
    this.frames = frames; this.grayBody = grayBody;
    if (!(body.material instanceof THREE.MeshStandardMaterial)
      || !(grayBody.material instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires soldier materials');
    this.bodyMaterial = illustratedMaterial(body.material.clone(), 'enemy'); this.bodyMaterial.color.set('white');
    this.deathMaterial = illustratedMaterial(grayBody.material.clone()); this.deathMaterial.transparent = true; this.deathMaterial.depthWrite = false;
    this.body = new THREE.Mesh(body.geometry, this.bodyMaterial);
    this.group.name = 'giant-assault-soldier';
    this.group.add(this.body, new THREE.Mesh(helmet.geometry, this.red), new THREE.Mesh(vest.geometry, this.red));

    // The existing face/helmet language is retained; faceted armor and independent
    // thick arms/mace provide a broad warlord silhouette instead of a dark slab.
    this.part(this.facet, this.gold, 0, .47, .30, .25, .19, .095);
    this.part(this.facet, this.red, 0, .47, .325, .225, .16, .085);
    this.part(this.box, this.gold, 0, .32, 0, .51, .075, .62);
    this.part(this.facet, this.red, 0, .33, .36, .075, .055, .035);
    this.part(this.box, this.red, 0, .45, -.31, .46, .32, .14);
    for (const side of [-1, 1]) {
      this.shoulders.push(this.part(this.facet, this.gold, side * .33, .58, 0, .18, .14, .25));
      this.shoulders.push(this.part(this.facet, this.red, side * .335, .58, .045, .155, .115, .22));
      for (const depth of [-.12, .02, .15])
        this.part(this.cone, this.gold, side * .40, .74, depth, .035, .17, .035);
      const arm = new THREE.Group(); arm.name = 'giant-arm'; arm.position.set(side * .31, .53, 0);
      this.group.add(arm); this.arms.push(arm);
      this.part(this.cylinder, this.skin, side * .04, -.09, .03, .075, .24, .09, arm);
      const forearm = new THREE.Group(); forearm.name = 'giant-forearm';
      forearm.position.y = -.12; arm.add(forearm); this.forearms.push(forearm);
      this.part(this.facet, this.red, side * .055, -.06, .09, .115, .13, .135, forearm);
      this.part(this.facet, this.gold, side * .055, 0, .12, .118, .055, .14, forearm);
      this.part(this.facet, this.skin, side * .065, -.15, .12, .095, .07, .10, forearm);
      this.part(this.facet, this.steel, side * .13, .10, .10, .10, .10, .18);
      this.part(this.facet, this.red, side * .13, .22, .17, .085, .09, .04);
    }
    const rim = this.part(this.trim, this.gold, 0, .78, 0, .31, .31, .31);
    rim.rotation.x = Math.PI / 2;
    this.part(this.box, this.gold, 0, .70, .29, .035, .12, .045);
    for (const x of [-.11, 0, .11])
      this.part(this.cone, this.gold, x, 1.04 + (x === 0 ? .035 : 0), .01, .04, .15, .055);

    const weapon = this.weapon; weapon.name = 'giant-mace';
    this.forearms[1].add(weapon); weapon.position.set(.10, 0, .18);
    this.part(this.cylinder, this.leather, 0, 0, 0, .032, .55, .032, weapon);
    this.part(this.facet, this.red, 0, .37, 0, .18, .22, .18, weapon);
    const band = this.part(this.trim, this.gold, 0, .37, 0, .19, .19, .19, weapon);
    band.rotation.x = Math.PI / 2;
    this.part(this.cone, this.gold, 0, .66, 0, .055, .18, .055, weapon);
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 2 / 5, direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const spike = this.part(this.cone, this.steel, direction.x * .24, .37, direction.z * .24, .045, .16, .045, weapon);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    this.palette = [this.red, this.gold, this.skin, this.steel, this.leather, this.bodyMaterial]
      .map(material => ({ material: illustratedMaterial(material), color: material.color.clone() }));
    this.group.updateMatrixWorld(true);
    this.dimensions = new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3());
    this.ring.rotation.x = -Math.PI / 2; this.ring.name = 'giant-death-impact';
    this.group.visible = this.ring.visible = false;
    this.haze.name = 'giant-emergence-haze';
    for (let i = 0; i < 4; i++) this.haze.add(new THREE.Sprite(this.hazeMaterial));
    this.chunks.name = 'giant-armor-wreckage'; this.chunks.visible = false; this.chunks.frustumCulled = false;
    for (let i = 0; i < 12; i++) this.chunks.setColorAt(i, new THREE.Color([ART.faction.giant, ART.faction.gold, ART.world.nearAccent][i % 3]));
    this.haze.visible = false;
    this.debrisGroup.add(this.chunks);
    scene.add(this.group, this.ring, this.haze, this.debrisGroup);
  }

  private part(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number,
    width: number, height: number, depth: number, parent: THREE.Group = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); parent.add(mesh); return mesh;
  }

  get id(): number | undefined { return this.previous?.id; }
  available(nowMs: number): boolean { return !this.previous || (Number.isFinite(this.deathAt) && nowMs - this.deathAt >= GIANT_DEATH_MS); }
  barVisible(nowMs: number): boolean { return giantReveal(nowMs - this.bornAt).barVisible; }
  getModelDimensions(): { width: number; height: number; depth: number } {
    return { width: this.dimensions.x, height: this.dimensions.y, depth: this.dimensions.z };
  }
  healthBarLayout(enemy: EnemyRenderState): { width: number; y: number } {
    const base = enemy.visualScale ?? 1;
    return { width: this.dimensions.x * (enemy.visualScaleX ?? base) * .75,
      y: this.dimensions.y * (enemy.visualScaleY ?? base) + .35 };
  }
  die(enemy: EnemyRenderState, nowMs: number): void {
    this.previous = enemy; this.deathAt = nowMs; this.ring.position.set(-enemy.x, .06, enemy.z - 1.5);
  }
  private restorePalette(): void {
    for (const { material, color } of this.palette) {
      material.color.copy(color); material.opacity = 1; material.transparent = false; material.emissiveIntensity = 0;
    }
  }
  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback): void {
    if (enemy) {
      if (this.previous?.id !== enemy.id) this.bornAt = nowMs;
      this.previous = enemy; this.deathAt = -Infinity; this.body.material = this.bodyMaterial;
      const cycle = enemy.gaitCycleMs ?? 850, phase = nowMs * Math.PI * 2 / cycle + enemy.id * 2.399963;
      const hit = hits.strength(enemy.id, nowMs);
      this.body.geometry = this.frames[Math.floor(nowMs / (cycle / 4) + enemy.id * 1.52788745) & 3].geometry;
      const weight = giantWeightPose(enemy.id, nowMs, cycle);
      this.arms.forEach((arm, index) => {
        const side = index === 0 ? 1 : -1;
        arm.rotation.z = 0;
        arm.rotation.x = weight.arm * side + .035 * hit;
        this.forearms[index].rotation.x = Math.sin(phase - .55 + index * Math.PI) * .07 + .02 * hit;
      });
      this.weapon.rotation.x = weight.weapon + .03 * hit;
      this.weapon.rotation.z = Math.sin(phase - .8) * .045;
      this.shoulders.forEach((shoulder, index) => { shoulder.rotation.z = weight.shoulder * (index < 2 ? 1 : -1); });
      this.group.position.set(-enemy.x, weight.bob, enemy.z + hit * .11);
      this.group.rotation.set(-.12 + hit * .06, Math.PI, weight.sway);
      const scale = enemy.visualScale ?? 1;
      this.group.scale.set(enemy.visualScaleX ?? scale, (enemy.visualScaleY ?? scale) * (1 - weight.compression), enemy.visualScaleZ ?? scale);
      this.group.visible = true; this.ring.visible = false; this.restorePalette();
      const reveal = giantReveal(nowMs - this.bornAt);
      for (const { material, color } of this.palette) {
        material.transparent = reveal.opacity < 1; material.opacity = reveal.opacity;
        material.color.set(ART.world.near).lerp(color, reveal.color);
      }
      this.haze.visible = nowMs - this.bornAt < GIANT_REVEAL_MS;
      this.hazeMaterial.color.set(ART.world.fog); this.hazeMaterial.opacity = reveal.haze;
      this.haze.children.forEach((cloud, index) => {
        cloud.position.set(-enemy.x + Math.sin(index * 2.4) * 1.1 + (nowMs - this.bornAt) * .00025,
          .9 + index * 1.05, enemy.z - 1.1 - index * .15);
        cloud.scale.set(4.7 + index * .35, 2.9, 1);
      });
      this.chunks.visible = false;
      this.red.emissiveIntensity = .45 * hit; this.gold.emissiveIntensity = .6 * hit;
      this.group.updateMatrixWorld(true);
      hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs);
      return;
    }
    this.haze.visible = false;
    const age = nowMs - this.deathAt;
    if (!this.previous || age < 0 || age >= GIANT_DEATH_MS) {
      this.group.visible = this.ring.visible = this.chunks.visible = false; return;
    }
    const pose = giantDeathPose(age), enemyScale = this.previous.visualScale ?? 1;
    const fall = pose.falling;
    this.group.visible = pose.bodyVisible; this.ring.visible = pose.ringOpacity > 0;
    this.group.rotation.set(-.12 - 1.42 * fall, Math.PI, .22 * fall);
    this.arms.forEach((arm, index) => { arm.rotation.x = -.6 * fall; arm.rotation.z = (index ? 1 : -1) * .4 * fall; });
    this.weapon.rotation.x = -.9 * fall; this.weapon.rotation.z = .25 * fall;
    this.group.scale.set(this.previous.visualScaleX ?? enemyScale, this.previous.visualScaleY ?? enemyScale, this.previous.visualScaleZ ?? enemyScale);
    this.group.position.set(-this.previous.x, .03 + .08 * (1 - fall) + .9 * fall, this.previous.z + .4 * fall);
    this.body.material = this.bodyMaterial; // Keep the recognizable massive body intact until the crash.
    for (const { material, color } of this.palette) {
      material.color.copy(color).lerp(this.coreColor, pose.lethalFlash);
      material.transparent = false; material.opacity = 1; material.emissiveIntensity = pose.lethalFlash * .6;
    }
    const impactAge = Math.max(0, age - GIANT_CRASH_MS);
    this.haze.visible = pose.crash && impactAge < 850;
    this.hazeMaterial.color.set(ART.fx.dust);
    this.hazeMaterial.opacity = .45 * Math.min(1, impactAge / 60) * Math.max(0, 1 - impactAge / 850);
    this.haze.children.forEach((cloud, index) => {
      const angle = index * 2.399963, spread = .8 + impactAge * .002;
      cloud.position.set(-this.previous!.x + Math.cos(angle) * spread, .35 + index * .12,
        this.previous!.z - 1.5 + Math.sin(angle) * spread);
      cloud.scale.set(3 + impactAge * .003, 1 + impactAge * .001, 1);
    });
    const footprint = (this.previous.visualScaleX ?? enemyScale) * .8;
    this.ring.scale.setScalar(footprint * (1 + impactAge / 280)); this.ringMaterial.opacity = pose.ringOpacity;
    this.chunks.visible = pose.debrisVisible; this.chunksMaterial.opacity = pose.debrisOpacity;
    if (pose.debrisVisible) {
      const seconds = Math.min(.6, Math.max(0, (age - 650) / 1000));
      for (let i = 0; i < 12; i++) {
        const phase = i * 2.399963 + this.previous.id * .71, distance = .45 + (i % 4) * .36;
        this.transform.position.set(-this.previous.x + Math.cos(phase) * distance * (1 + seconds * .6),
          .13 + Math.max(0, Math.sin(seconds / .6 * Math.PI) * (.35 + (i % 3) * .15)),
          this.previous.z - 1.5 + Math.sin(phase) * distance * 1.4);
        this.transform.rotation.set(phase + seconds * 2, phase * .7, .4 + phase);
        this.transform.scale.set(.4 + (i % 3) * .18, .25 + (i % 2) * .18, .55 + (i % 4) * .15);
        this.transform.updateMatrix(); this.chunks.setMatrixAt(i, this.transform.matrix);
      }
      this.chunks.instanceMatrix.needsUpdate = true;
    }
  }
  reset(): void {
    this.previous = undefined; this.deathAt = -Infinity; this.group.visible = this.ring.visible = this.haze.visible = this.chunks.visible = false; this.bornAt = -Infinity; this.restorePalette();
  }
  dispose(): void {
    this.scene.remove(this.group, this.ring, this.haze, this.debrisGroup);
    this.hazeMap.dispose(); this.hazeMaterial.dispose(); this.chunksMaterial.dispose(); this.chunks.dispose();
    for (const geometry of [this.box, this.facet, this.cylinder, this.cone, this.trim, this.ringGeometry]) geometry.dispose();
    for (const { material } of this.palette) material.dispose(); this.deathMaterial.dispose(); this.ringMaterial.dispose();
  }
}
