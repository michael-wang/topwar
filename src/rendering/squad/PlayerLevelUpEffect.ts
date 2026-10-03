import { ART } from '../../art/ArtDirection';
import * as THREE from 'three';
import { LEVEL_UP_MS } from '../../presentation/ProgressionLevelUp';

const MAX_EFFECT_MEMBERS = 24;
const MOTES_PER_MEMBER = 8;
// Shared geometry/materials, reusable per-member bursts; no simulation state or particle framework.
export class PlayerLevelUpEffect {
  private startedAtMs = -Infinity;
  private readonly visuals: THREE.Group[] = [];
  private readonly ringGeometry: THREE.RingGeometry;
  private readonly moteGeometry = new THREE.SphereGeometry(.055, 6, 4);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: ART.coastalUi.aqua, transparent: true,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, toneMapped: false });
  private readonly moteMaterial = new THREE.MeshBasicMaterial({ color: ART.coastalUi.foam, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  private readonly aquaMoteMaterial = this.moteMaterial.clone();
  constructor(private readonly scene: THREE.Scene,
    private readonly envelope = { radius: .49, height: 1.1 }) {
    this.ringGeometry = new THREE.RingGeometry(envelope.radius * .82, envelope.radius, 40);
    this.aquaMoteMaterial.color.set(ART.coastalUi.energy);
  }
  present(nowMs: number): void { this.startedAtMs = nowMs; }
  update(members: readonly { group: THREE.Group }[], nowMs: number): void {
    const age = nowMs - this.startedAtMs;
    const active = age >= 0 && age < LEVEL_UP_MS;
    const progress = Math.max(0, Math.min(1, age / LEVEL_UP_MS));
    this.ringMaterial.opacity = .95 * (1 - progress);
    this.moteMaterial.opacity = Math.min(1, (1 - progress) * 1.8);
    this.aquaMoteMaterial.opacity = this.moteMaterial.opacity;
    let index = 0;
    if (active) for (const member of members) {
      if (!member.group.visible || index >= MAX_EFFECT_MEMBERS) continue;
      const group = this.visuals[index] ?? this.createVisual();
      group.visible = true;
      group.position.copy(member.group.position);
      const ring = group.children[0];
      ring.scale.setScalar(.65 + 2 * progress);
      for (let mote = 0; mote < MOTES_PER_MEMBER; mote++) {
        const angle = mote * Math.PI * 2 / MOTES_PER_MEMBER + index * 2.4 + progress * .8;
        const radius = this.envelope.radius * (.72 + .92 * progress);
        const spark = group.children[mote + 1];
        spark.position.set(Math.cos(angle) * radius, .12 + progress * (this.envelope.height + (mote % 3) * .3), Math.sin(angle) * radius);
        spark.scale.setScalar(1.15 - .6 * progress);
      }
      index++;
    }
    for (; index < this.visuals.length; index++) this.visuals[index].visible = false;
  }
  reset(): void { this.startedAtMs = -Infinity; for (const visual of this.visuals) visual.visible = false; }
  dispose(): void {
    for (const visual of this.visuals) this.scene.remove(visual);
    this.visuals.length = 0;
    this.ringGeometry.dispose(); this.moteGeometry.dispose();
    this.ringMaterial.dispose(); this.moteMaterial.dispose(); this.aquaMoteMaterial.dispose();
  }
  private createVisual(): THREE.Group {
    const group = new THREE.Group(); group.name = 'player-level-up-burst';
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    ring.name = 'progression-ground-ring'; ring.rotation.x = -Math.PI / 2; ring.position.y = .055;
    group.add(ring);
    for (let mote = 0; mote < MOTES_PER_MEMBER; mote++) group.add(new THREE.Mesh(this.moteGeometry, mote % 2 ? this.moteMaterial : this.aquaMoteMaterial));
    this.scene.add(group); this.visuals.push(group); return group;
  }
}
