import * as THREE from 'three';
import type { StreamRewardRenderState } from '../RenderState';

interface RewardVisual {
  panel: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  hitProgress: number;
}

export class StreamRewardRenderer {
  private readonly panelGeometry = new THREE.BoxGeometry(0.65, 1.25, 0.22);
  private readonly labelGeometry = new THREE.PlaneGeometry(0.82, 0.9);
  // The panel sits across the firing lane. Blend it over tracers so shots that
  // ignore this reward tier remain visible as they travel through the plaque.
  private readonly tier1Material = new THREE.MeshBasicMaterial({
    color: '#1ac1ed', transparent: true, opacity: 0.55, depthWrite: false,
  });
  private readonly tier2Material = new THREE.MeshBasicMaterial({
    color: '#edc242', transparent: true, opacity: 0.55, depthWrite: false,
  });
  private readonly visuals = new Map<number, RewardVisual>();

  constructor(private readonly scene: THREE.Scene) {}

  update(rewards: readonly StreamRewardRenderState[]): void {
    const active = new Set(rewards.map((reward) => reward.id));
    for (const [id, visual] of this.visuals) {
      if (!active.has(id)) {
        this.remove(visual);
        this.visuals.delete(id);
      }
    }
    for (const reward of rewards) {
      let visual = this.visuals.get(reward.id);
      if (!visual) {
        const panel = new THREE.Mesh(this.panelGeometry,
          reward.tier === 1 ? this.tier1Material : this.tier2Material);
        this.scene.add(panel);
        visual = { panel, label: null, hitProgress: NaN };
        this.visuals.set(reward.id, visual);
      }
      const x = -reward.x;
      visual.panel.position.set(x, 0.7, reward.z);
      visual.panel.scale.setScalar(reward.tier === 1 ? 1 : 1.25);
      if (visual.hitProgress !== reward.hitProgress) {
        this.removeLabel(visual);
        visual.label = this.createLabel(reward);
        visual.hitProgress = reward.hitProgress;
      }
      if (visual.label) {
        visual.label.position.set(x, reward.tier === 1 ? 0.8 : 0.95,
          reward.z - (reward.tier === 1 ? 0.145 : 0.18));
        visual.label.scale.setScalar(reward.tier === 1 ? 1 : 1.2);
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) this.remove(visual);
    this.visuals.clear();
    this.panelGeometry.dispose();
    this.labelGeometry.dispose();
    this.tier1Material.dispose();
    this.tier2Material.dispose();
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
