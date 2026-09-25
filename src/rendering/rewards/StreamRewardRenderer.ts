import * as THREE from 'three';
import type { StreamRewardRenderState } from '../RenderState';
import { REWARD_PALETTE, paletteIndex } from '../tierPalettes';

interface RewardVisual {
  panel: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  hitProgress: number;
  pulseStartedAtMs: number | null;
}

const PULSE_MS = 100;
const POP_MS = 190;

export class StreamRewardRenderer {
  private readonly panelGeometry = new THREE.BoxGeometry(0.65, 1.25, 0.22);
  private readonly labelGeometry = new THREE.PlaneGeometry(0.82, 0.9);
  // Blend the plaque over tracers so the firing lane stays readable.
  private readonly panelMaterials = REWARD_PALETTE.map((color) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  private readonly visuals = new Map<number, RewardVisual>();
  private readonly pops: { panel: RewardVisual['panel']; startedAtMs: number; baseScale: number;
    startY: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  update(rewards: readonly StreamRewardRenderState[], nowMs = performance.now()): void {
    const active = new Set(rewards.map((reward) => reward.id));
    for (const [id, visual] of this.visuals) {
      if (!active.has(id)) {
        this.removeLabel(visual);
        this.pops.push({ panel: visual.panel, startedAtMs: nowMs,
          baseScale: visual.panel.scale.x, startY: visual.panel.position.y });
        this.visuals.delete(id);
      }
    }
    for (let index = this.pops.length - 1; index >= 0; index--) {
      const pop = this.pops[index];
      const progress = Math.max(0, (nowMs - pop.startedAtMs) / POP_MS);
      if (progress >= 1) {
        this.scene.remove(pop.panel);
        this.pops.splice(index, 1);
      } else {
        pop.panel.scale.setScalar(pop.baseScale * (1 + 0.75 * progress));
        pop.panel.position.y = pop.startY + 0.25 * progress;
      }
    }
    for (const reward of rewards) {
      let visual = this.visuals.get(reward.id);
      if (!visual) {
        const panel = new THREE.Mesh(this.panelGeometry,
          this.panelMaterials[paletteIndex(reward.tier, REWARD_PALETTE.length)]);
        this.scene.add(panel);
        visual = { panel, label: null, hitProgress: NaN, pulseStartedAtMs: null };
        this.visuals.set(reward.id, visual);
      }
      const x = -reward.x;
      visual.panel.position.set(x, 0.7, reward.z);
      if (visual.hitProgress !== reward.hitProgress) {
        if (reward.hitProgress > visual.hitProgress) visual.pulseStartedAtMs = nowMs;
        this.removeLabel(visual);
        visual.label = this.createLabel(reward);
        visual.hitProgress = reward.hitProgress;
      }
      const pulseProgress = visual.pulseStartedAtMs === null
        ? 1 : Math.min(1, Math.max(0, (nowMs - visual.pulseStartedAtMs) / PULSE_MS));
      if (pulseProgress === 1) visual.pulseStartedAtMs = null;
      const pulseScale = 1 + 0.12 * (1 - pulseProgress);
      const baseScale = reward.tier === 1 ? 1 : 1.25;
      visual.panel.scale.setScalar(baseScale * pulseScale);
      if (visual.label) {
        visual.label.position.set(x, reward.tier === 1 ? 0.8 : 0.95,
          reward.z - (reward.tier === 1 ? 0.145 : 0.18));
        visual.label.scale.setScalar((reward.tier === 1 ? 1 : 1.2) * pulseScale);
      }
    }
  }

  reset(): void {
    for (const visual of this.visuals.values()) this.remove(visual);
    this.visuals.clear();
    for (const pop of this.pops) this.scene.remove(pop.panel);
    this.pops.length = 0;
  }

  dispose(): void {
    this.reset();
    this.panelGeometry.dispose();
    this.labelGeometry.dispose();
    for (const material of this.panelMaterials) material.dispose();
  }

  private createLabel(reward: StreamRewardRenderState): RewardVisual['label'] {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#102030';
    context.font = 'bold 70px sans-serif';
    context.fillText(`+1 T${reward.tier}`, 128, 88);
    context.font = 'bold 64px sans-serif';
    context.fillText(`${reward.hitProgress}/${reward.hitsRequired}`, 128, 172);
    const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas),
      transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const label = new THREE.Mesh(this.labelGeometry, material);
    label.rotation.y = Math.PI;
    this.scene.add(label);
    return label;
  }

  private removeLabel(visual: RewardVisual): void {
    if (!visual.label) return;
    this.scene.remove(visual.label);
    visual.label.material.map?.dispose();
    visual.label.material.dispose();
    visual.label = null;
  }

  private remove(visual: RewardVisual): void {
    this.scene.remove(visual.panel);
    this.removeLabel(visual);
  }
}
