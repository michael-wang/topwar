import * as THREE from 'three';
import type { UpgradeGateRenderState } from '../RenderState';

interface GateVisual {
  wall: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  wallLabel: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  plaques: THREE.Group[];
  hp: number;
}

export class UpgradeGateRenderer {
  private readonly wallGeometry = new THREE.BoxGeometry(1, 1.5, 0.85);
  private readonly plaqueGeometry = new THREE.BoxGeometry(1, 0.53, 0.16);
  private readonly labelGeometry = new THREE.PlaneGeometry(1, 1.1);
  private readonly plaqueLabelGeometry = new THREE.PlaneGeometry(1, 0.42);
  private readonly rifleMaterial = new THREE.MeshBasicMaterial({ color: '#18b8e8' });
  private readonly rocketMaterial = new THREE.MeshBasicMaterial({ color: '#e99420' });
  private readonly rewardLabels = {
    rifle: this.createTextMaterial(['+1']),
    rocket: this.createTextMaterial(['+1']),
  };
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
        const wall = new THREE.Mesh(this.wallGeometry,
          gate.rewardKind === 'rifle' ? this.rifleMaterial : this.rocketMaterial);
        this.scene.add(wall);
        visual = { wall, wallLabel: null, plaques: [], hp: NaN };
        this.visuals.set(gate.id, visual);
      }
      const visualX = -gate.x;
      visual.wall.visible = gate.hp > 0;
      visual.wall.position.set(visualX, 0.85, gate.z);
      visual.wall.scale.x = gate.width;
      if (visual.hp !== gate.hp) {
        this.removeWallLabel(visual);
        if (gate.hp > 0) visual.wallLabel = this.createWallLabel(gate);
        visual.hp = gate.hp;
      }
      if (visual.wallLabel) {
        visual.wallLabel.position.set(visualX, 1.02, gate.z - 0.44);
        visual.wallLabel.scale.x = gate.width * 1.45;
      }

      while (visual.plaques.length < gate.rewardTotal) {
        visual.plaques.push(this.createPlaque(gate.rewardKind));
      }
      const collected = gate.rewardTotal - gate.rewardsRemaining;
      visual.plaques.forEach((plaque, index) => {
        plaque.visible = index >= collected && index < gate.rewardTotal;
        // Raise the queued rewards above the wall so all tokens remain visible before it breaks.
        plaque.position.set(visualX, 2.03, gate.z + 1.2 + index * 0.95);
        plaque.scale.x = gate.width * 1.15;
      });
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) this.remove(visual);
    this.visuals.clear();
    this.wallGeometry.dispose();
    this.plaqueGeometry.dispose();
    this.labelGeometry.dispose();
    this.plaqueLabelGeometry.dispose();
    this.rifleMaterial.dispose();
    this.rocketMaterial.dispose();
    for (const material of Object.values(this.rewardLabels)) {
      material?.map?.dispose();
      material?.dispose();
    }
  }

  private createPlaque(kind: UpgradeGateRenderState['rewardKind']): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(this.plaqueGeometry, kind === 'rifle' ? this.rifleMaterial : this.rocketMaterial));
    const material = this.rewardLabels[kind];
    if (material) {
      const label = new THREE.Mesh(this.plaqueLabelGeometry, material);
      label.rotation.y = Math.PI;
      label.position.z = -0.09;
      group.add(label);
    }
    this.scene.add(group);
    return group;
  }

  private createWallLabel(gate: UpgradeGateRenderState): GateVisual['wallLabel'] {
    const material = this.createTextMaterial([gate.rewardKind.toUpperCase(), `WALL ${Math.ceil(gate.hp)}`]);
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
    context.font = lines.length === 1 ? 'bold 180px sans-serif' : 'bold 82px sans-serif';
    if (lines.length === 1) {
      context.fillText(lines[0], 256, 100);
    } else {
      context.fillText(lines[0], 256, 67);
      context.font = 'bold 67px sans-serif';
      context.fillText(lines[1], 256, 145);
    }
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true,
      side: THREE.DoubleSide, depthWrite: false });
  }

  private removeWallLabel(visual: GateVisual): void {
    if (!visual.wallLabel) return;
    this.scene.remove(visual.wallLabel);
    visual.wallLabel.material.map?.dispose();
    visual.wallLabel.material.dispose();
    visual.wallLabel = null;
  }

  private remove(visual: GateVisual): void {
    this.scene.remove(visual.wall);
    this.removeWallLabel(visual);
    for (const plaque of visual.plaques) this.scene.remove(plaque);
  }
}
