import * as THREE from 'three';
import type { EnemyRenderState } from '../RenderState';
import type { HeavyHitFeedback } from './HeavyHitFeedback';

const DEATH_MS = 650;

// One introduction per run: reuse one disposable armored silhouette and death beat.
export class GiantRenderer {
  private readonly group = new THREE.Group();
  private readonly armor = new THREE.MeshStandardMaterial({ color: '#303d43', roughness: .8 });
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly deathMaterial: THREE.MeshStandardMaterial;
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly body: THREE.Mesh;
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffd69b', transparent: true,
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
    if (!(body.material instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires soldier material');
    if (!(grayBody.material instanceof THREE.MeshStandardMaterial)) throw new Error('Giant requires gray death material');
    this.deathMaterial = grayBody.material.clone(); this.deathMaterial.transparent = true; this.deathMaterial.depthWrite = false;
    this.bodyMaterial = body.material.clone();
    this.bodyMaterial.color.set('#687578');
    this.body = new THREE.Mesh(body.geometry, this.bodyMaterial);
    this.group.name = 'giant-assault-soldier';
    this.group.add(this.body, new THREE.Mesh(helmet.geometry, this.armor), new THREE.Mesh(vest.geometry, this.armor));
    // Slab shoulder armor, heavy backpack and a narrow visor change the silhouette,
    // rather than merely enlarging the amber Heavy. Coordinates are model-local.
    for (const [x, y, z, width, height, depth] of [
      [-.3, .55, 0, .22, .18, .54], [.3, .55, 0, .22, .18, .54],
      [0, .42, -.32, .46, .32, .15], [0, .69, .265, .34, .08, .065],
      [0, .42, .32, .46, .22, .12],
    ]) {
      const plate = new THREE.Mesh(this.box, this.armor);
      plate.position.set(x, y, z); plate.scale.set(width, height, depth); this.group.add(plate);
    }
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.name = 'giant-death-impact';
    this.group.visible = this.ring.visible = false;
    scene.add(this.group, this.ring);
  }

  die(enemy: EnemyRenderState, nowMs: number): void {
    this.previous = enemy; this.deathAt = nowMs;
    this.ring.position.set(-enemy.x, .06, enemy.z);
  }

  update(enemy: EnemyRenderState | undefined, nowMs: number, hits: HeavyHitFeedback): void {
    if (enemy) {
      this.previous = enemy; this.deathAt = -Infinity; this.body.material = this.bodyMaterial;
      const cycle = enemy.gaitCycleMs ?? 850;
      const phase = nowMs * Math.PI * 2 / cycle + enemy.id * 2.399963;
      const hit = hits.strength(enemy.id, nowMs);
      this.body.geometry = this.frames[Math.floor(nowMs / (cycle / 4) + enemy.id * 1.52788745) & 3].geometry;
      this.group.position.set(-enemy.x, Math.abs(Math.sin(phase)) * .035, enemy.z + hit * .11);
      this.group.rotation.set(-.12 + hit * .06, Math.PI, Math.sin(phase) * .018);
      const scale = enemy.visualScale ?? 1;
      this.group.scale.set(enemy.visualScaleX ?? scale, enemy.visualScaleY ?? scale, enemy.visualScaleZ ?? scale);
      this.group.visible = true; this.ring.visible = false;
      this.bodyMaterial.color.set('#687578'); this.armor.color.set(hit > 0 ? '#a99a7b' : '#303d43');
      this.bodyMaterial.opacity = this.armor.opacity = 1;
      this.group.updateMatrixWorld(true);
      hits.setBody(enemy.id, this.body.geometry, this.body.matrixWorld, nowMs);
      return;
    }
    const age = nowMs - this.deathAt;
    if (!this.previous || age < 0 || age >= DEATH_MS) { this.group.visible = this.ring.visible = false; return; }
    const p = age / DEATH_MS, scale = 1 - .8 * p;
    this.group.visible = this.ring.visible = true;
    const base = this.previous.visualScale ?? 1;
    this.group.scale.set(this.previous.visualScaleX ?? base, this.previous.visualScaleY ?? base, this.previous.visualScaleZ ?? base).multiplyScalar(scale);
    this.group.position.set(-this.previous.x, .12 + .35 * p, this.previous.z);
    this.body.geometry = this.grayBody.geometry; this.body.material = this.deathMaterial;
    this.deathMaterial.opacity = 1 - p;
    this.bodyMaterial.color.set('#aeb8bb'); this.armor.color.set(age < 80 ? '#ffe4ad' : '#aeb8bb');
    this.bodyMaterial.transparent = this.armor.transparent = true;
    this.bodyMaterial.opacity = this.armor.opacity = 1 - p;
    this.ring.scale.setScalar(1 + 2.5 * p); this.ringMaterial.opacity = .75 * (1 - p);
  }

  reset(): void { this.previous = undefined; this.deathAt = -Infinity; this.group.visible = this.ring.visible = false; this.bodyMaterial.transparent = this.armor.transparent = false; }
  dispose(): void {
    this.scene.remove(this.group, this.ring);
    this.box.dispose(); this.bodyMaterial.dispose(); this.deathMaterial.dispose(); this.armor.dispose(); this.ringGeometry.dispose(); this.ringMaterial.dispose();
  }
}
