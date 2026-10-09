import * as THREE from 'three';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import { sampleArtillery, type ArtilleryEvent } from '../simulation/artillery';
import type { GameRenderState } from './RenderState';
import { GrenadeExplosion } from './GrenadeExplosion';
import { ART } from '../art/ArtDirection';
import { LOCK_ON_ALERT_MS, warningInnerRadius } from '../presentation/ArtilleryWarning';

function exclamationGeometry(): THREE.ShapeGeometry {
  const stem = new THREE.Shape(); stem.moveTo(-.12, .18); stem.lineTo(-.18, .78);
  stem.lineTo(.18, .78); stem.lineTo(.12, .18); stem.closePath();
  const dot = new THREE.Shape(); dot.absarc(0, -.05, .12, 0, Math.PI * 2, false);
  return new THREE.ShapeGeometry([stem, dot]);
}

// Created lazily when an artillery source is activated; ordinary Stage 1 allocates none.
// All meshes/materials are retained in bounded slots. No per-frame vectors or trail objects.
export class EnemyArtilleryRenderer {
  private readonly bodyGeometry = new THREE.CylinderGeometry(.15, .15, .55, 10);
  private readonly noseGeometry = new THREE.ConeGeometry(.15, .26, 10);
  private readonly sphere = new THREE.SphereGeometry(1, 8, 6);
  private readonly ring = new THREE.RingGeometry(.85, 1, 32);
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#26313b', metalness: .5, roughness: .45 });
  private readonly nose = new THREE.MeshStandardMaterial({ color: '#c4b795', metalness: .45, roughness: .4 });
  private readonly hot = new THREE.MeshBasicMaterial({ color: '#ffbe71' });
  private readonly point = { x: 0, y: 0, z: 0 };
  private readonly direction = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly slots: ReturnType<EnemyArtilleryRenderer['createSlot']>[] = [];
  private readonly impacts: GrenadeExplosion;
  private readonly glyph = exclamationGeometry();
  private readonly alertMaterial = new THREE.MeshBasicMaterial({ color: '#ff334b', transparent: true, depthTest: false });
  private readonly alert = new THREE.Mesh(this.glyph, this.alertMaterial);
  private alertAtMs = -Infinity;
  private lastSimulationSeconds = -Infinity;
  constructor(private readonly scene: THREE.Scene) {
    this.impacts = new GrenadeExplosion(scene, ARTILLERY_CAPACITY, false);
    this.alert.name = 'artillery-lock-on'; this.alert.renderOrder = 12; scene.add(this.alert);
    for (let i = 0; i < ARTILLERY_CAPACITY; i++) this.slots.push(this.createSlot(i));
    this.reset();
  }
  private createSlot(index: number) {
    const shell = new THREE.Group(); shell.name = `enemy-shell-${index}`;
    shell.scale.setScalar(2); // Fixed toy-art silhouette, readable even at the offshore end.
    const body = new THREE.Mesh(this.bodyGeometry, this.dark), tip = new THREE.Mesh(this.noseGeometry, this.nose);
    // The ballistic point is the leading tip, so visible ground contact and damage coincide.
    body.position.y = -.53; tip.position.y = -.13;
    const band = new THREE.Mesh(this.bodyGeometry, this.hot); band.scale.set(1.05, .10, 1.05); band.position.y = -.68;
    shell.add(body, tip, band);
    const warning = new THREE.Group(); warning.name = `enemy-shell-warning-${index}`;
    const borderMat = new THREE.MeshBasicMaterial({ color: '#241d28', depthWrite: false, side: THREE.DoubleSide });
    const redMat = new THREE.MeshBasicMaterial({ color: ART.enemyHealth.heavy, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const fillMat = new THREE.MeshBasicMaterial({ color: '#f2555f', transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide });
    const border = new THREE.Mesh(this.ring, borderMat), rim = new THREE.Mesh(this.ring, redMat);
    const progressGeometry = new THREE.RingGeometry(1, 1, 32);
    const fill = new THREE.Mesh(progressGeometry, fillMat), symbol = new THREE.Mesh(this.glyph, redMat);
    rim.scale.setScalar(.97); fill.scale.setScalar(.84);
    symbol.scale.setScalar(.65); symbol.position.set(0, .008, .18);
    for (const mesh of [border, rim, fill, symbol]) { mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5; }
    warning.add(border, fill, rim, symbol);
    const trailMat = new THREE.MeshBasicMaterial({ color: '#f1d5b0', transparent: true, opacity: .55, depthWrite: false });
    const trail = Array.from({ length: 4 }, () => new THREE.Mesh(this.sphere, trailMat));
    const flash = new THREE.Mesh(this.sphere, this.hot); flash.name = `enemy-cannon-flash-${index}`;
    this.scene.add(shell, warning, flash, ...trail);
    return { shell, warning, progressGeometry, redMat, fillMat, trail, flash, materials: [borderMat, redMat, fillMat, trailMat] };
  }
  present(events: readonly ArtilleryEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.kind === 'artilleryImpact') this.impacts.present(event.x, event.z, event.radius, nowMs);
      else this.alertAtMs = nowMs;
    }
  }
  update(state: GameRenderState['artillery'], nowMs: number, player = { x: 0, z: 0 }, cameraRotation?: THREE.Quaternion): void {
    if (!state || state.elapsedSeconds < this.lastSimulationSeconds) this.reset();
    this.lastSimulationSeconds = state?.elapsedSeconds ?? -Infinity;
    this.impacts.update(nowMs, 0);
    const alertAge = nowMs - this.alertAtMs;
    this.alert.visible = !!state?.shells.length && alertAge >= 0 && alertAge < LOCK_ON_ALERT_MS;
    this.alert.position.set(-player.x, 1.7, player.z);
    if (cameraRotation) this.alert.quaternion.copy(cameraRotation);
    this.alert.scale.setScalar(.7 + .18 * Math.sin(Math.max(0, alertAge) / 45) ** 2);
    this.alertMaterial.opacity = Math.min(1, Math.max(0, (LOCK_ON_ALERT_MS - alertAge) / 110));
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i], shell = state?.shells[i];
      s.shell.visible = s.warning.visible = !!shell; s.flash.visible = false;
      for (const trail of s.trail) trail.visible = false;
      if (!shell || !state) continue;
      const age = Math.max(0, state.elapsedSeconds - shell.launchedAtSeconds), progress = Math.min(1, age / shell.flightSeconds);
      sampleArtillery(shell, state.elapsedSeconds, this.point);
      s.shell.position.set(-this.point.x, this.point.y, this.point.z);
      const source = shell.source.position, duration = shell.flightSeconds;
      this.direction.set(-(shell.target.x - source.x) / duration,
        -source.y / duration + .5 * shell.flight.gravity * duration - shell.flight.gravity * age,
        (shell.target.z - source.z) / duration).normalize();
      s.shell.quaternion.setFromUnitVectors(this.up, this.direction);
      // Outer edge is fixed at the collision radius. Only the interior closes/pulses.
      s.warning.position.set(-shell.target.x, .035, shell.target.z); s.warning.scale.setScalar(shell.radius);
      const inner = warningInnerRadius(progress), positions = s.progressGeometry.attributes.position;
      for (let j = 0; j <= 32; j++) positions.setXY(j, Math.cos(j / 32 * Math.PI * 2) * inner, Math.sin(j / 32 * Math.PI * 2) * inner);
      positions.needsUpdate = true;
      s.redMat.opacity = .72 + .28 * Math.sin(age * (10 + progress * 12)) ** 2;
      s.fillMat.opacity = .22 + progress * .18;
      s.flash.visible = age < .18;
      s.flash.position.set(-source.x, source.y, source.z); s.flash.scale.setScalar(.25 + .8 * Math.sin(Math.min(1, age / .18) * Math.PI));
      for (let j = 0; j < s.trail.length; j++) {
        const lag = (j + 2) * .035, trail = s.trail[j]; trail.visible = age > lag;
        sampleArtillery(shell, state.elapsedSeconds - lag, this.point);
        trail.position.set(-this.point.x, this.point.y, this.point.z); trail.scale.setScalar(.15 - j * .025);
      }
    }
  }
  getDebugStats() { return { capacity: this.slots.length, shells: this.slots.filter(s => s.shell.visible).length,
    warnings: this.slots.filter(s => s.warning.visible).length, impacts: this.impacts.active }; }
  reset(): void {
    this.lastSimulationSeconds = -Infinity; this.impacts.reset(); this.alertAtMs = -Infinity; this.alert.visible = false;
    for (const s of this.slots) { s.shell.visible = s.warning.visible = s.flash.visible = false;
      for (const trail of s.trail) trail.visible = false; }
  }
  dispose(): void {
    this.impacts.dispose(); this.scene.remove(this.alert); this.glyph.dispose(); this.alertMaterial.dispose();
    for (const s of this.slots) { this.scene.remove(s.shell, s.warning, s.flash, ...s.trail);
      s.progressGeometry.dispose(); for (const material of s.materials) material.dispose(); }
    for (const resource of [this.bodyGeometry, this.noseGeometry, this.sphere, this.ring, this.dark, this.nose, this.hot]) resource.dispose();
  }
}
