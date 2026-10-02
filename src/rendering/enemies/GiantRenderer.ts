import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import type { HeavyHitFeedback } from './HeavyHitFeedback';

const DEATH_MS = 650;

// One introduction per run; all ornament/weapon motion is disposable presentation.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly red = new THREE.MeshStandardMaterial({ color: '#d32d3e', roughness: .65,
    emissive: '#ffc16f', emissiveIntensity: 0 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: '#ffc650', roughness: .5,
    metalness: .1, emissive: '#fff0b9', emissiveIntensity: 0 });
  private readonly skin = new THREE.MeshStandardMaterial({ color: '#e7b88c', roughness: .9 });
  private readonly steel = new THREE.MeshStandardMaterial({ color: '#879eac', roughness: .6 });
  private readonly leather = new THREE.MeshStandardMaterial({ color: '#614438', roughness: .9 });
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterial: THREE.MeshStandardMaterial;
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly facet = new THREE.IcosahedronGeometry(1, 0);
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 6);
  private readonly cone = new THREE.ConeGeometry(1, 1, 5);
  private readonly trim = new THREE.TorusGeometry(1, .08, 5, 12);
  private readonly body: THREE.Mesh;
  private readonly arms: THREE.Group[] = [];
  private readonly palette: { material: THREE.MeshStandardMaterial; color: THREE.Color }[];
  private readonly dimensions: THREE.Vector3;
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffe6aa', transparent: true,
    opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private readonly ringGeometry = new THREE.RingGeometry(1, 1.2, 32);
  private readonly ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private previous: EnemyRenderState | undefined;
  private deathAt = -Infinity;
  constructor(private readonly scene: THREE.Scene,
    body: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    helmet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    vest: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
    private readonly frames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[],
    private readonly grayBody: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    if (!(body.material instanceof THREE.MeshStandardMaterial)
      || !(grayBody.material instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires soldier materials');
    this.bodyMaterial = body.material.clone(); this.bodyMaterial.color.set('white');
    this.deathMaterial = grayBody.material.clone(); this.deathMaterial.transparent = true; this.deathMaterial.depthWrite = false;
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
      this.part(this.facet, this.gold, side * .33, .58, 0, .18, .14, .25);
      this.part(this.facet, this.red, side * .335, .58, .045, .155, .115, .22);
      for (const depth of [-.12, .02, .15])
        this.part(this.cone, this.gold, side * .40, .74, depth, .035, .17, .035);
      const arm = new THREE.Group(); arm.name = 'giant-arm'; arm.position.set(side * .31, .53, 0);
      this.group.add(arm); this.arms.push(arm);
      this.part(this.cylinder, this.skin, side * .04, -.09, .03, .075, .24, .09, arm);
      this.part(this.facet, this.red, side * .055, -.18, .09, .115, .13, .135, arm);
      this.part(this.facet, this.gold, side * .055, -.12, .12, .118, .055, .14, arm);
      this.part(this.facet, this.skin, side * .065, -.27, .12, .095, .07, .10, arm);
      this.part(this.facet, this.steel, side * .13, .10, .10, .10, .10, .18);
      this.part(this.facet, this.red, side * .13, .22, .17, .085, .09, .04);
    }
    const rim = this.part(this.trim, this.gold, 0, .78, 0, .31, .31, .31);
    rim.rotation.x = Math.PI / 2;
    this.part(this.box, this.gold, 0, .70, .29, .035, .12, .045);
    for (const x of [-.11, 0, .11])
      this.part(this.cone, this.gold, x, 1.04 + (x === 0 ? .035 : 0), .01, .04, .15, .055);

    const weapon = new THREE.Group(); weapon.name = 'giant-mace';
    this.arms[1].add(weapon); weapon.position.set(.10, -.12, .18);
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
      .map(material => ({ material, color: material.color.clone() }));
    this.group.updateMatrixWorld(true);
    this.dimensions = new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3());
    this.ring.rotation.x = -Math.PI / 2; this.ring.name = 'giant-death-impact';
    this.group.visible = this.ring.visible = false;
    scene.add(this.group, this.ring);
  }

  private part(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number,
    width: number, height: number, depth: number, parent: THREE.Group = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); parent.add(mesh); return mesh;
  }

  getModelDimensions(): { width: number; height: number; depth: number } {
    return { width: this.dimensions.x, height: this.dimensions.y, depth: this.dimensions.z };
  }
  healthBarLayout(enemy: EnemyRenderState): { width: number; y: number } {
    const base = enemy.visualScale ?? 1;
    return { width: this.dimensions.x * (enemy.visualScaleX ?? base) * .75,
      y: this.dimensions.y * (enemy.visualScaleY ?? base) + .35 };
  }
  die(enemy: EnemyRenderState, nowMs: number): void {
    this.previous = enemy; this.deathAt = nowMs; this.ring.position.set(-enemy.x, .06, enemy.z);
  }
  private restorePalette(): void {
    for (const { material, color } of this.palette) {
      material.color.copy(color); material.opacity = 1; material.transparent = false; material.emissiveIntensity = 0;
    }
  }
  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback): void {
    if (enemy) {
      this.previous = enemy; this.deathAt = -Infinity; this.body.material = this.bodyMaterial;
      const cycle = enemy.gaitCycleMs ?? 850, phase = nowMs * Math.PI * 2 / cycle + enemy.id * 2.399963;
      const hit = hits.strength(enemy.id, nowMs);
      this.body.geometry = this.frames[Math.floor(nowMs / (cycle / 4) + enemy.id * 1.52788745) & 3].geometry;
      this.arms.forEach((arm, index) => { arm.rotation.x = Math.sin(phase + index * Math.PI) * .12; });
      this.group.position.set(-enemy.x, Math.abs(Math.sin(phase)) * .035, enemy.z + hit * .11);
      this.group.rotation.set(-.12 + hit * .06, Math.PI, Math.sin(phase) * .018);
      const scale = enemy.visualScale ?? 1;
      this.group.scale.set(enemy.visualScaleX ?? scale, enemy.visualScaleY ?? scale, enemy.visualScaleZ ?? scale);
      this.group.visible = true; this.ring.visible = false; this.restorePalette();
      this.red.emissiveIntensity = .45 * hit; this.gold.emissiveIntensity = .6 * hit;
      this.group.updateMatrixWorld(true);
      hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs);
      return;
    }
    const age = nowMs - this.deathAt;
    if (!this.previous || age < 0 || age >= DEATH_MS) { this.group.visible = this.ring.visible = false; return; }
    const p = age / DEATH_MS, scale = 1 - .8 * p, base = this.previous.visualScale ?? 1;
    this.group.visible = this.ring.visible = true;
    this.group.scale.set(this.previous.visualScaleX ?? base, this.previous.visualScaleY ?? base, this.previous.visualScaleZ ?? base).multiplyScalar(scale);
    this.group.position.set(-this.previous.x, .12 + .25 * p, this.previous.z);
    this.body.geometry = this.grayBody.geometry; this.body.material = this.deathMaterial; this.deathMaterial.opacity = 1 - p;
    for (const { material } of this.palette) {
      material.color.set(age < 80 ? '#fff1bd' : '#aeb6bc'); material.transparent = true;
      material.opacity = 1 - p; material.emissiveIntensity = 0;
    }
    const footprint = (this.previous.visualScaleX ?? base) * .5;
    this.ring.scale.setScalar(footprint * (1 + 2 * p)); this.ringMaterial.opacity = .85 * (1 - p);
  }
  reset(): void {
    this.previous = undefined; this.deathAt = -Infinity; this.group.visible = this.ring.visible = false; this.restorePalette();
  }
  dispose(): void {
    this.scene.remove(this.group, this.ring);
    for (const geometry of [this.box, this.facet, this.cylinder, this.cone, this.trim, this.ringGeometry]) geometry.dispose();
    for (const { material } of this.palette) material.dispose(); this.deathMaterial.dispose(); this.ringMaterial.dispose();
  }
}
