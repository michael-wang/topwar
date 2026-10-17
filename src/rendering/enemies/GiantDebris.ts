import * as THREE from 'three';
import { ENEMY_DEATH_TIMING } from '../../presentation/EnemyDeathTiming';

export const GIANT_DEBRIS = { startMs: 120, fadeStartMs: ENEMY_DEATH_TIMING.giant.fadeStartMs,
  totalMs: ENEMY_DEATH_TIMING.giant.totalMs, groundY: .035, pieces: 11 } as const;
const smooth = (p: number) => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
export function giantDebrisOpacity(ageMs: number): number {
  return 1 - smooth((ageMs - GIANT_DEBRIS.fadeStartMs) / (GIANT_DEBRIS.totalMs - GIANT_DEBRIS.fadeStartMs));
}

// Eleven rigid world-space transforms, shared by the original three metal draws.
// Captured vertex support points keep even the ram's irregular shape on the sand.
export class GiantDebris {
  readonly enabled = { value: 0 };
  readonly matrices = { value: Array.from({ length: 11 }, () => new THREE.Matrix4()) };
  private readonly counts = new Uint32Array(11);
  private readonly points: Float64Array[];
  private readonly boxes = Array.from({ length: 11 }, () => new THREE.Box3());
  private readonly centers = Array.from({ length: 11 }, () => new THREE.Vector3());
  private readonly flight = new Float64Array(11);
  private readonly targetY = new Float64Array(11);
  private readonly velocity = Array.from({ length: 11 }, () => new THREE.Vector3());
  private readonly rotations = Array.from({ length: 11 }, () => new THREE.Vector3());
  private readonly point = new THREE.Vector3();
  private readonly euler = new THREE.Euler();
  private readonly rotation = new THREE.Matrix4();

  constructor(private readonly meshes: readonly THREE.Mesh[], geometries: readonly THREE.BufferGeometry[]) {
    const capacities = new Uint32Array(11), counts = new Uint32Array(11);
    for (const geometry of geometries) {
      counts.fill(0);
      const p = geometry.getAttribute('position'), ids = geometry.getAttribute('deathPieceId');
      for (let i = 0; i < p.count; i++) counts[ids ? ids.getX(i) : 0]++;
      for (let id = 0; id < 11; id++) capacities[id] = Math.max(capacities[id], counts[id]);
    }
    // At death only one run pose is captured, together with helmet and ram.
    for (let mesh = 1; mesh < meshes.length; mesh++) {
      const p = meshes[mesh].geometry.getAttribute('position'), ids = meshes[mesh].geometry.getAttribute('deathPieceId');
      for (let i = 0; i < p.count; i++) capacities[ids ? ids.getX(i) : 0]++;
    }
    this.points = Array.from(capacities, capacity => new Float64Array(capacity * 3));
  }

  prepareMaterial(material: THREE.MeshStandardMaterial): void {
    const previous = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer);
      shader.uniforms.giantDebrisEnabled = this.enabled;
      shader.uniforms.giantDebrisMatrices = this.matrices;
      shader.vertexShader = `uniform float giantDebrisEnabled; uniform mat4 giantDebrisMatrices[11]; attribute float deathPieceId;\n${shader.vertexShader}`
        .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
          if (giantDebrisEnabled > .5) {
            mat3 viewRotation = mat3(viewMatrix);
            transformedNormal = viewRotation * mat3(giantDebrisMatrices[int(deathPieceId)]) * transpose(viewRotation) * transformedNormal;
          }`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          if (giantDebrisEnabled > .5) {
            mvPosition = viewMatrix * giantDebrisMatrices[int(deathPieceId)] * modelMatrix * vec4(transformed, 1.);
            gl_Position = projectionMatrix * mvPosition;
          }`);
    };
    material.customProgramCacheKey = () => 'giant-grounded-metal-v1';
  }

  capture(variant: number): void {
    this.counts.fill(0);
    for (const box of this.boxes) box.makeEmpty();
    for (const mesh of this.meshes) {
      mesh.updateWorldMatrix(true, false);
      const p = mesh.geometry.getAttribute('position'), ids = mesh.geometry.getAttribute('deathPieceId');
      for (let i = 0; i < p.count; i++) {
        const id = ids ? ids.getX(i) : 0, at = this.counts[id]++ * 3;
        this.point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        this.boxes[id].expandByPoint(this.point);
        this.point.toArray(this.points[id], at);
      }
    }
    for (let id = 0; id < 11; id++) {
      if (!this.counts[id]) continue;
      const box = this.boxes[id], center = this.centers[id]; box.getCenter(center);
      const angle = id * 2.399963 + variant * .65;
      this.flight[id] = Math.min(1.05, .34 + Math.sqrt(Math.max(0, box.min.y - GIANT_DEBRIS.groundY)) * .36);
      this.velocity[id].set(Math.cos(angle) * (id === 3 || id === 4 ? 1.5 : 2.2), .8, Math.sin(angle) * 1.2 - .4);
      this.rotations[id].set((id % 2 ? 1 : -1) * (id >= 9 ? .25 : 1.1), Math.sin(angle) * .6, Math.cos(angle) * .7);
      this.setRotation(id, 1);
      this.targetY[id] = GIANT_DEBRIS.groundY - this.floor(id);
      // Enough lift for a short arc, with positive gravity even for low shoe pieces.
      this.velocity[id].y += Math.max(0, this.targetY[id]) / this.flight[id];
    }
    this.enabled.value = 1; this.update(0);
  }

  private setRotation(id: number, progress: number): void {
    const r = this.rotations[id];
    this.rotation.makeRotationFromEuler(this.euler.set(r.x * progress, r.y * progress, r.z * progress));
  }
  private floor(id: number): number {
    const p = this.points[id], center = this.centers[id], m = this.rotation.elements;
    let floor = Infinity;
    for (let i = 0; i < this.counts[id] * 3; i += 3)
      floor = Math.min(floor, center.y + m[1] * (p[i] - center.x) + m[5] * (p[i + 1] - center.y) + m[9] * (p[i + 2] - center.z));
    return floor;
  }
  update(ageMs: number): void {
    const t = Math.max(0, (ageMs - GIANT_DEBRIS.startMs) / 1000);
    for (let id = 0; id < 11; id++) {
      if (!this.counts[id]) continue;
      const duration = this.flight[id], travel = Math.min(t, duration), v = this.velocity[id], center = this.centers[id];
      this.setRotation(id, smooth(travel / duration));
      const gravity = 2 * (v.y * duration - this.targetY[id]) / (duration * duration);
      const floorOffset = GIANT_DEBRIS.groundY - this.floor(id);
      const y = t >= duration ? floorOffset : Math.max(floorOffset, v.y * travel - .5 * gravity * travel * travel);
      const skid = t > duration ? .12 * (1 - Math.exp(-(t - duration) / .12)) : 0;
      const matrix = this.matrices.value[id].copy(this.rotation), m = matrix.elements;
      m[12] = center.x + v.x * (travel + skid) - (m[0] * center.x + m[4] * center.y + m[8] * center.z);
      m[13] = center.y + y - (m[1] * center.x + m[5] * center.y + m[9] * center.z);
      m[14] = center.z + v.z * (travel + skid) - (m[2] * center.x + m[6] * center.y + m[10] * center.z);
    }
  }
  landingAgeMs(id: number): number { return GIANT_DEBRIS.startMs + this.flight[id] * 1000; }
  landingPoint(id: number, target: THREE.Vector3): void {
    target.copy(this.centers[id]).addScaledVector(this.velocity[id], this.flight[id]);
    target.y = GIANT_DEBRIS.groundY;
  }
  reset(): void { this.enabled.value = 0; for (const matrix of this.matrices.value) matrix.identity(); }
}
