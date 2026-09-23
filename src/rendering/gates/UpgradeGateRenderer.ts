import * as THREE from 'three';
import type { UpgradeGateRenderState } from '../RenderState';

interface GateVisual {
  panel: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  hp: number;
  rewardKind: UpgradeGateRenderState['rewardKind'];
  rewardAmount: number;
}

export class UpgradeGateRenderer {
  private readonly panelGeometry = new THREE.BoxGeometry(1, 1.45, 0.12);
  private readonly labelGeometry = new THREE.PlaneGeometry(1, 1.06);
  private readonly rifleMaterial = new THREE.MeshBasicMaterial({ color: '#18b8e8' });
  private readonly rocketMaterial = new THREE.MeshBasicMaterial({ color: '#e99420' });
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
        const panel = new THREE.Mesh(this.panelGeometry,
          gate.rewardKind === 'rifle' ? this.rifleMaterial : this.rocketMaterial);
        this.scene.add(panel);
        visual = { panel, label: null, hp: NaN, rewardKind: gate.rewardKind, rewardAmount: gate.rewardAmount };
        this.visuals.set(gate.id, visual);
      }
      // The camera looks toward +Z, so visual X is mirrored consistently with soldiers and enemies.
      visual.panel.position.set(-gate.x, 0.83, gate.z);
      visual.panel.scale.x = gate.width;
      if (visual.hp !== gate.hp || visual.rewardKind !== gate.rewardKind || visual.rewardAmount !== gate.rewardAmount) {
        this.removeLabel(visual);
        visual.label = this.createLabel(gate);
        visual.hp = gate.hp;
        visual.rewardKind = gate.rewardKind;
        visual.rewardAmount = gate.rewardAmount;
      }
      if (visual.label) {
        visual.label.position.set(-gate.x, 0.95, gate.z - 0.075);
        visual.label.scale.x = Math.min(gate.width * 0.92, 2.1);
      }
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) this.remove(visual);
    this.visuals.clear();
    this.panelGeometry.dispose();
    this.labelGeometry.dispose();
    this.rifleMaterial.dispose();
    this.rocketMaterial.dispose();
  }

  private createLabel(gate: UpgradeGateRenderState): GateVisual['label'] {
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
    context.font = 'bold 72px sans-serif';
    context.fillText(`+${gate.rewardAmount} ${gate.rewardKind.toUpperCase()}`, 256, 69);
    context.font = 'bold 66px sans-serif';
    context.fillText(`HP ${Math.ceil(gate.hp)}`, 256, 145);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const label = new THREE.Mesh(this.labelGeometry, material);
    label.rotation.y = Math.PI;
    this.scene.add(label);
    return label;
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
