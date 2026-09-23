import * as THREE from 'three';
import type { UpgradeGateRenderState } from '../RenderState';

interface GateVisual {
  panel: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  hp: number;
}

export class UpgradeGateRenderer {
  private readonly wallGeometry = new THREE.BoxGeometry(1, 1.5, 0.85);
  private readonly labelGeometry = new THREE.PlaneGeometry(1, 1.1);
  private readonly generatorMaterial = new THREE.MeshBasicMaterial({ color: '#18b8e8' });
  private readonly jackpotMaterial = new THREE.MeshBasicMaterial({ color: '#efbd36' });
  private readonly visuals = new Map<string, GateVisual>();

  constructor(private readonly scene: THREE.Scene) {}

  update(gates: readonly UpgradeGateRenderState[]): void {
    const active = new Set(gates.map((gate) => gate.id));
    for (const [id, visual] of this.visuals) {
      if (!active.has(id)) {
        this.remove(visual);
        this.visuals.delete(id);
      }
    }
    for (const gate of gates) {
      let visual = this.visuals.get(gate.id);
      if (!visual) {
        const panel = new THREE.Mesh(this.wallGeometry,
          gate.rewardMode === 'pickup' ? this.generatorMaterial : this.jackpotMaterial);
        this.scene.add(panel);
        visual = { panel, label: null, hp: NaN };
        this.visuals.set(gate.id, visual);
      }
      const visualX = -gate.x;
      visual.panel.position.set(visualX, gate.hp > 0 ? 0.85 : 0.55, gate.z);
      visual.panel.scale.set(gate.width, gate.hp > 0 ? 1 : 0.45, gate.hp > 0 ? 1 : 0.35);
      if (visual.hp !== gate.hp) {
        this.removeLabel(visual);
        visual.label = this.createLabel(gate);
        visual.hp = gate.hp;
      }
      if (visual.label) {
        visual.label.position.set(visualX, gate.hp > 0 ? 1.02 : 0.55,
          gate.z - (gate.hp > 0 ? 0.44 : 0.16));
        visual.label.scale.x = gate.width * 1.45;
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) this.remove(visual);
    this.visuals.clear();
    this.wallGeometry.dispose();
    this.labelGeometry.dispose();
    this.generatorMaterial.dispose();
    this.jackpotMaterial.dispose();
  }

  private createLabel(gate: UpgradeGateRenderState): GateVisual['label'] {
    const unit = gate.rewardKind.toUpperCase();
    const lines = gate.rewardMode === 'pickup'
      ? gate.hp > 0
        ? [`${unit} +${gate.rewardAmount}/${gate.rewardIntervalSeconds}s`, `WALL ${Math.ceil(gate.hp)}`]
        : [`+${gate.rewardAmount} ${unit}`, `EVERY ${gate.rewardIntervalSeconds}s`]
      : [`+${gate.rewardAmount} ${unit}`, `WALL ${Math.ceil(gate.hp)}`];
    const material = this.createTextMaterial(lines);
    if (!material) return null;
    const label = new THREE.Mesh(this.labelGeometry, material);
    label.rotation.y = Math.PI;
    this.scene.add(label);
    return label;
  }

  private createTextMaterial(lines: string[]): THREE.MeshBasicMaterial | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#102030';
    context.font = 'bold 76px sans-serif';
    context.fillText(lines[0], 256, 67);
    context.font = 'bold 67px sans-serif';
    context.fillText(lines[1], 256, 145);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true,
      side: THREE.DoubleSide, depthWrite: false });
  }

  private removeLabel(visual: GateVisual): void {
    if (!visual.label) return;
    this.scene.remove(visual.label);
    visual.label.material.map?.dispose();
    visual.label.material.dispose();
    visual.label = null;
  }

  private remove(visual: GateVisual): void {
    this.scene.remove(visual.panel);
    this.removeLabel(visual);
  }
}
