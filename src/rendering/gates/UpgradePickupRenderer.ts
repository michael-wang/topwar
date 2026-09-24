import * as THREE from 'three';
import type { UpgradePickupRenderState } from '../RenderState';

export class UpgradePickupRenderer {
  private readonly plaqueGeometry = new THREE.BoxGeometry(0.72, 0.72, 0.1);
  private readonly labelGeometry = new THREE.PlaneGeometry(0.65, 0.56);
  private readonly plaqueMaterial = new THREE.MeshBasicMaterial({ color: '#18b8e8' });
  private readonly jackpotMaterial = new THREE.MeshBasicMaterial({ color: '#efbd36' });
  private readonly labelMaterials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly visuals = new Map<number, THREE.Group>();

  constructor(private readonly scene: THREE.Scene) {}

  update(pickups: readonly UpgradePickupRenderState[]): void {
    const active = new Set(pickups.map((pickup) => pickup.id));
    for (const [id, visual] of this.visuals) {
      if (!active.has(id)) {
        this.scene.remove(visual);
        this.visuals.delete(id);
      }
    }
    for (const pickup of pickups) {
      let visual = this.visuals.get(pickup.id);
      if (!visual) {
        visual = new THREE.Group();
        visual.add(new THREE.Mesh(this.plaqueGeometry,
          pickup.rewardAmount === 1 ? this.plaqueMaterial : this.jackpotMaterial));
        const labelMaterial = this.getLabelMaterial(pickup.rewardAmount);
        if (labelMaterial) {
          const label = new THREE.Mesh(this.labelGeometry, labelMaterial);
          label.position.z = -0.06;
          label.rotation.y = Math.PI;
          visual.add(label);
        }
        this.scene.add(visual);
        this.visuals.set(pickup.id, visual);
      }
      // The camera faces the reversed visual X axis, as for the squad and armories.
      visual.position.set(-pickup.x, 0.9, pickup.z);
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) this.scene.remove(visual);
    this.visuals.clear();
    this.plaqueGeometry.dispose();
    this.labelGeometry.dispose();
    this.plaqueMaterial.dispose();
    this.jackpotMaterial.dispose();
    for (const material of this.labelMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.labelMaterials.clear();
  }

  private getLabelMaterial(amount: number): THREE.MeshBasicMaterial | null {
    const cached = this.labelMaterials.get(amount);
    if (cached) return cached;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#102030';
    context.font = 'bold 104px sans-serif';
    context.fillText(`+${amount}`, 128, 64);
    const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true,
      side: THREE.DoubleSide, depthWrite: false });
    this.labelMaterials.set(amount, material);
    return material;
  }
}
