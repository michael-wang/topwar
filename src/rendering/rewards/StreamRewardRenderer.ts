import * as THREE from 'three';
import type { StreamRewardRenderState } from '../RenderState';
import { REWARD_PALETTE, paletteIndex } from '../tierPalettes';

interface RewardVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  lid: THREE.Mesh;
  fill: THREE.Mesh;
  cracks: [THREE.LineSegments, THREE.LineSegments];
  accent: THREE.MeshBasicMaterial;
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

function soldierIcon(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-.18, -.06);
  for (const [x, y] of [[.18, -.06], [.18, -.025], [.145, -.025], [.13, .09],
    [.08, .15], [0, .17], [-.08, .15], [-.13, .09], [-.145, -.025],
    [-.18, -.025]] as const) shape.lineTo(x, y);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export class StreamRewardRenderer {
  private readonly crateGeometry = new THREE.BoxGeometry(.78, .68, .34);
  private readonly lidGeometry = new THREE.BoxGeometry(.84, .13, .4);
  private readonly strapGeometry = new THREE.BoxGeometry(.08, .68, .025);
  private readonly plaqueGeometry = new THREE.BoxGeometry(.47, .38, .025);
  private readonly iconGeometry = soldierIcon();
  private readonly plusGeometry = new THREE.PlaneGeometry(.08, .08);
  private readonly barGeometry = new THREE.PlaneGeometry(.53, .1);
  private readonly crackGeometries = [
    crackGeometry([-.33, .22, -.25, .12, -.3, .04, -.2, -.04]),
    crackGeometry([.32, .23, .24, .14, .29, .05, .2, -.07]),
  ] as const;
  private readonly crateMaterial = new THREE.MeshStandardMaterial({ color: '#405864', roughness: .85 });
  private readonly damagedMaterial = new THREE.MeshStandardMaterial({ color: '#96938a', roughness: .9 });
  private readonly plaqueMaterial = new THREE.MeshBasicMaterial({ color: '#20353c' });
  private readonly iconMaterial = new THREE.MeshBasicMaterial({ color: '#fff4d5', side: THREE.DoubleSide });
  private readonly barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: '#172b30' });
  private readonly crackMaterial = new THREE.LineBasicMaterial({ color: '#ffe4a8' });
  private readonly warningMaterial = new THREE.MeshBasicMaterial({ color: '#fff0a0' });
  private readonly warningFlashMaterial = new THREE.MeshBasicMaterial({ color: '#ff9b4a' });
  private readonly accents = REWARD_PALETTE.map((color) => new THREE.MeshBasicMaterial({ color }));
  private readonly visuals = new Map<number, RewardVisual>();
  private readonly pops: { group: THREE.Group; startedAtMs: number; scale: number; y: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

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
      visual.body.material = nearBreak ? this.damagedMaterial : this.crateMaterial;
      visual.lid.material = nearBreak
        ? Math.floor(nowMs / 90) % 2 === 0 ? this.warningMaterial : this.warningFlashMaterial
        : visual.accent;
      visual.fill.material = nearBreak ? this.warningMaterial : visual.accent;
      const baseScale = reward.tier === 1 ? 1 : 1.16;
      visual.group.scale.setScalar(baseScale * (1 + .1 * (1 - pulse)));
      visual.group.rotation.z = Math.sin(Math.PI * pulse) * .12;
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
      this.plaqueGeometry, this.iconGeometry, this.plusGeometry, this.barGeometry,
      ...this.crackGeometries]) geometry.dispose();
    for (const material of [this.crateMaterial, this.damagedMaterial, this.plaqueMaterial, this.iconMaterial,
      this.barBackgroundMaterial, this.crackMaterial, this.warningMaterial, this.warningFlashMaterial,
      ...this.accents]) material.dispose();
  }

  private createVisual(tier: number): RewardVisual {
    const group = new THREE.Group();
    group.name = 'soldier-reward-crate';
    const accent = this.accents[paletteIndex(tier, this.accents.length)];
    const body = new THREE.Mesh(this.crateGeometry, this.crateMaterial);
    body.name = 'crate-body';
    const lid = new THREE.Mesh(this.lidGeometry, accent);
    lid.name = 'crate-lid';
    lid.position.y = .36;
    group.add(body, lid);
    for (const x of [-.28, .28]) {
      const strap = new THREE.Mesh(this.strapGeometry, accent);
      strap.position.set(x, 0, -.185);
      group.add(strap);
    }
    const plaque = new THREE.Mesh(this.plaqueGeometry, this.plaqueMaterial);
    plaque.position.set(0, .015, -.196);
    group.add(plaque);
    const icon = new THREE.Mesh(this.iconGeometry, this.iconMaterial);
    icon.name = 'soldier-plus-icon';
    icon.position.set(-.035, .04, -.212);
    group.add(icon);
    for (const [width, height] of [[.09, .025], [.025, .09]]) {
      const plus = new THREE.Mesh(this.plusGeometry, this.iconMaterial);
      plus.position.set(.145, .055, -.214);
      plus.scale.set(width / .08, height / .08, 1);
      group.add(plus);
    }
    const background = new THREE.Mesh(this.barGeometry, this.barBackgroundMaterial);
    background.position.set(0, -.255, -.201);
    group.add(background);
    const fill = new THREE.Mesh(this.barGeometry, accent);
    fill.name = 'remaining-durability';
    fill.position.set(0, -.255, -.21);
    group.add(fill);
    const cracks: [THREE.LineSegments, THREE.LineSegments] = [
      new THREE.LineSegments(this.crackGeometries[0], this.crackMaterial),
      new THREE.LineSegments(this.crackGeometries[1], this.crackMaterial),
    ];
    group.add(...cracks);
    return { group, body, lid, fill, cracks, accent, hitProgress: 0, hitAtMs: null };
  }
}
