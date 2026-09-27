import * as THREE from 'three';
import type { StreamRewardRenderState } from '../RenderState';
import { PLAYER_PALETTE, paletteIndex } from '../tierPalettes';

interface RewardVisual {
  group: THREE.Group;
  fill: THREE.Mesh;
  warning: THREE.Mesh;
  cracks: [THREE.LineSegments, THREE.LineSegments];
  hitProgress: number;
  hitAtMs: number | null;
}
const HIT_MS = 140;
const POP_MS = 190;

function crackGeometry(points: number[]): THREE.BufferGeometry {
  const lines: number[] = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    lines.push(points[i], points[i + 1], -.215, points[i + 2], points[i + 3], -.215);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return geometry;
}

export class StreamRewardRenderer {
  private readonly crateGeometry = new THREE.BoxGeometry(.78, .68, .34);
  private readonly lidGeometry = new THREE.BoxGeometry(.84, .13, .4);
  private readonly strapGeometry = new THREE.BoxGeometry(.08, .68, .025);
  private readonly warningGeometry = new THREE.BoxGeometry(.8, .06, .03);
  private readonly barGeometry = new THREE.PlaneGeometry(.53, .1);
  private readonly crackGeometries = [
    crackGeometry([-.33, .22, -.25, .12, -.3, .04, -.2, -.04]),
    crackGeometry([.32, .23, .24, .14, .29, .05, .2, -.07]),
  ] as const;
  private readonly crateMaterial = new THREE.MeshStandardMaterial({ color: '#f2c94c', roughness: .58,
    metalness: .08, emissive: '#6f4910', emissiveIntensity: .08 });
  private readonly lidMaterial = new THREE.MeshStandardMaterial({ color: '#ffd86a', roughness: .5 });
  private readonly strapMaterial = new THREE.MeshStandardMaterial({ color: '#c98c28', roughness: .68 });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#79511d' });
  private readonly barFillMaterial = new THREE.MeshBasicMaterial({ color: '#fff2a7' });
  private readonly crackMaterial = new THREE.LineBasicMaterial({ color: '#824621' });
  private readonly warningMaterial = new THREE.MeshBasicMaterial({ color: '#ff9545' });
  private readonly warningFlashMaterial = new THREE.MeshBasicMaterial({ color: '#ff553b' });
  private readonly helmetMaterials: THREE.MeshStandardMaterial[];
  private readonly visuals = new Map<number, RewardVisual>();
  private readonly pops: { group: THREE.Group; startedAtMs: number; scale: number; y: number }[] = [];

  constructor(private readonly scene: THREE.Scene,
    private readonly helmetModel: THREE.Mesh<THREE.BufferGeometry, THREE.Material>) {
    const source = helmetModel.material;
    if (!(source instanceof THREE.MeshStandardMaterial)) throw new Error('Reward helmet needs a standard material');
    this.helmetMaterials = PLAYER_PALETTE.map((entry) => {
      const material = source.clone();
      material.color.set(entry.body);
      return material;
    });
  }

  update(rewards: readonly StreamRewardRenderState[], nowMs = performance.now()): void {
    const active = new Set(rewards.map((reward) => reward.id));
    for (const [id, visual] of this.visuals) {
      if (!active.has(id)) {
        this.pops.push({ group: visual.group, startedAtMs: nowMs,
          scale: visual.group.scale.x, y: visual.group.position.y });
        this.visuals.delete(id);
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i];
      const progress = Math.max(0, (nowMs - pop.startedAtMs) / POP_MS);
      if (progress >= 1) {
        this.scene.remove(pop.group);
        this.pops.splice(i, 1);
      } else {
        pop.group.scale.setScalar(pop.scale * (1 + .7 * progress));
        pop.group.position.y = pop.y + .3 * progress;
      }
    }
    for (const reward of rewards) {
      let visual = this.visuals.get(reward.id);
      if (!visual) {
        visual = this.createVisual(reward.tier);
        this.visuals.set(reward.id, visual);
        this.scene.add(visual.group);
      }
      const remaining = Math.max(0, 1 - reward.hitProgress / reward.hitsRequired);
      if (reward.hitProgress > visual.hitProgress) visual.hitAtMs = nowMs;
      visual.hitProgress = reward.hitProgress;
      visual.cracks[0].visible = remaining <= .65;
      visual.cracks[1].visible = remaining <= .3;
      visual.fill.scale.x = remaining;
      visual.fill.position.x = -.265 * (1 - remaining);
      const pulse = visual.hitAtMs === null ? 1
        : Math.min(1, Math.max(0, (nowMs - visual.hitAtMs) / HIT_MS));
      if (pulse === 1) visual.hitAtMs = null;
      const nearBreak = remaining <= .2;
      visual.warning.visible = nearBreak;
      visual.warning.material = Math.floor(nowMs / 90) % 2 === 0
        ? this.warningMaterial : this.warningFlashMaterial;
      visual.fill.material = nearBreak ? this.warningMaterial : this.barFillMaterial;
      const baseScale = reward.tier === 1 ? 1 : 1.16;
      visual.group.scale.setScalar(baseScale * (1 + .1 * (1 - pulse)));
      visual.group.rotation.z = Math.sin(Math.PI * pulse) * .12
        + (nearBreak ? Math.sin(nowMs * .035) * .06 : 0);
      visual.group.position.set(-reward.x, .39, reward.z);
    }
  }

  reset(): void {
    for (const visual of this.visuals.values()) this.scene.remove(visual.group);
    this.visuals.clear();
    for (const pop of this.pops) this.scene.remove(pop.group);
    this.pops.length = 0;
  }

  dispose(): void {
    this.reset();
    for (const geometry of [this.crateGeometry, this.lidGeometry, this.strapGeometry,
      this.warningGeometry, this.barGeometry,
      ...this.crackGeometries]) geometry.dispose();
    for (const material of [this.crateMaterial, this.lidMaterial, this.strapMaterial,
      this.barBackgroundMaterial, this.barFillMaterial, this.crackMaterial,
      this.warningMaterial, this.warningFlashMaterial, ...this.helmetMaterials]) material.dispose();
  }

  private createVisual(tier: number): RewardVisual {
    const group = new THREE.Group();
    group.name = 'soldier-reward-crate';
    const tierIndex = paletteIndex(tier, this.helmetMaterials.length);
    const body = new THREE.Mesh(this.crateGeometry, this.crateMaterial);
    body.name = 'crate-body';
    const lid = new THREE.Mesh(this.lidGeometry, this.lidMaterial);
    lid.name = 'crate-lid';
    lid.position.y = .36;
    group.add(body, lid);
    for (const x of [-.28, .28]) {
      const strap = new THREE.Mesh(this.strapGeometry, this.strapMaterial);
      strap.name = 'crate-strap';
      strap.position.set(x, 0, -.185);
      group.add(strap);
    }
    const helmet = new THREE.Mesh(this.helmetModel.geometry, this.helmetMaterials[tierIndex]);
    helmet.name = 'reward-soldier-helmet';
    helmet.scale.set(.9, .9, .45);
    helmet.position.set(0, -.62, -.39);
    helmet.rotation.y = Math.PI;
    group.add(helmet);
    const warning = new THREE.Mesh(this.warningGeometry, this.warningMaterial);
    warning.name = 'near-break-warning';
    warning.position.set(0, .36, -.22);
    warning.visible = false;
    group.add(warning);
    const background = new THREE.Mesh(this.barGeometry, this.barBackgroundMaterial);
    background.position.set(0, -.255, -.201);
    group.add(background);
    const fill = new THREE.Mesh(this.barGeometry, this.barFillMaterial);
    fill.name = 'remaining-durability';
    fill.position.set(0, -.255, -.21);
    group.add(fill);
    const cracks: [THREE.LineSegments, THREE.LineSegments] = [
      new THREE.LineSegments(this.crackGeometries[0], this.crackMaterial),
      new THREE.LineSegments(this.crackGeometries[1], this.crackMaterial),
    ];
    group.add(...cracks);
    return { group, fill, warning, cracks, hitProgress: 0, hitAtMs: null };
  }
}
