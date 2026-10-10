import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import { coastalCameraFov } from '../src/rendering/renderSize';

function setup(width = 350, height = 844) {
  const scene = new THREE.Scene();
  const bullet = new THREE.Mesh(new THREE.BoxGeometry(.052, .052, .52), new THREE.MeshBasicMaterial());
  const renderer = new ProjectileRenderer(scene, bullet, { height: .37145, offsetX: 0 });
  const camera = new THREE.PerspectiveCamera(coastalCameraFov(width / height), width / height, .1, 180);
  camera.position.set(0, 6.5, -10); camera.lookAt(0, 0, 12.5); camera.updateMatrixWorld();
  const shot = { id: 1, kind: 'rifle' as const, tier: 1, x: 0, z: 30, hitRadiusBonus: 0, slopeX: 0 };
  const update = (now = 100) => renderer.update([shot], now, camera, height);
  const core = () => scene.getObjectByName('rifle-tracers') as THREE.InstancedMesh;
  const edge = () => scene.getObjectByName('tracer-glows') as THREE.InstancedMesh;
  const vertices = (mesh: THREE.InstancedMesh) => {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
    const positions = mesh.geometry.getAttribute('position');
    return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
  };
  const pixels = (mesh: THREE.InstancedMesh) => {
    const points = vertices(mesh).map(v => v.project(camera));
    return { width: (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * width / 2,
      length: (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * height / 2 };
  };
  return { scene, bullet, renderer, camera, shot, update, core, edge, pixels, vertices };
}

describe('Defense tracer readability', () => {
  it.each([350, 390])('keeps a bounded 2 px ivory core and 3 px ink silhouette at %i CSS px', width => {
    const s = setup(width); s.update(0);
    for (const z of [20, 30, 40]) {
      s.shot.z = z; s.update();
      expect(s.pixels(s.core()).width).toBeCloseTo(2, 4);
      expect(s.pixels(s.edge()).width).toBeCloseTo(3, 4);
      expect(s.pixels(s.core()).length).toBeCloseTo(7, 4);
    }
    const core = s.core().material as THREE.MeshBasicMaterial, edge = s.edge().material as THREE.MeshBasicMaterial;
    expect(core.color.getHexString()).toBe('fff4e5'); expect(edge.color.getHexString()).toBe('24465a');
    expect(core.transparent).toBe(true); expect(core.opacity).toBe(1); expect(edge.opacity).toBe(1);
    expect(edge.depthWrite).toBe(false); expect(core.depthTest).toBe(true);
    expect(s.core().renderOrder).toBeGreaterThan(s.edge().renderOrder);
    expect(s.core().renderOrder).toBeLessThan(10); // Enemy HP indicators.
    s.shot.z = 150; s.update();
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(); s.core().getMatrixAt(0, matrix); scale.setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(ART.defenseTracer.maxCoreWidth); expect(scale.z).toBeCloseTo(ART.defenseTracer.maxLength);
    s.renderer.dispose();
  });

  it.each([-.3, 0, .3])('keeps every trail vertex behind the shot and follows projected motion (slope %f)', slopeX => {
    const s = setup(); s.shot.slopeX = slopeX; s.shot.x = 3; s.update(0); s.update();
    const anchor = new THREE.Vector3(-3, .37145, 30).project(s.camera);
    const direction = new THREE.Vector3(-3 - slopeX, .37145, 31).project(s.camera).sub(anchor);
    direction.set(direction.x * s.camera.aspect, direction.y, 0).normalize();
    for (const mesh of [s.core(), s.edge()]) {
      const vertices = s.vertices(mesh).map(v => v.project(s.camera).sub(anchor));
      for (const v of vertices) expect(v.set(v.x * s.camera.aspect, v.y, 0).dot(direction)).toBeLessThan(1e-7);
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
      expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(-3, .37145, 30))).toBeLessThan(1e-6);
    }
    s.renderer.dispose();
  });

  it('retains a stronger additive afterglow, resets for Retry, and restores Legacy materials/geometry', () => {
    const s = setup(); s.update(0); s.update(); const ordinary = s.pixels(s.edge()).width;
    s.renderer.presentLevelUp(100); s.update(200);
    expect(s.pixels(s.core()).width).toBeCloseTo(2.4, 4);
    expect(s.pixels(s.edge()).width).toBeGreaterThan(ordinary * 1.8);
    expect((s.edge().material as THREE.MeshBasicMaterial).blending).toBe(THREE.AdditiveBlending);
    s.renderer.reset(); s.update(300);
    expect((s.edge().material as THREE.MeshBasicMaterial).color.getHexString()).toBe('24465a');
    s.renderer.update([s.shot], 400);
    expect(s.core().geometry).toBe(s.bullet.geometry); expect(s.edge().geometry).toBe(s.bullet.geometry);
    expect((s.core().material as THREE.MeshBasicMaterial).transparent).toBe(false);
    expect((s.edge().material as THREE.MeshBasicMaterial).opacity).toBe(.6);
    expect(s.core().renderOrder).toBe(0); expect(s.edge().renderOrder).toBe(0);
    s.renderer.dispose();
  });

  it('reuses one owned geometry through growth/reset and releases it without touching the GLB', () => {
    const s = setup(); s.update(); const geometry = s.core().geometry;
    const ownedDispose = vi.spyOn(geometry, 'dispose'), borrowedDispose = vi.spyOn(s.bullet.geometry, 'dispose');
    const original = Array.from(s.bullet.geometry.getAttribute('position').array);
    s.renderer.update(Array.from({ length: 54 }, (_, id) => ({ ...s.shot, id })), 200, s.camera, 844);
    expect(s.scene.children).toHaveLength(2); expect(s.core().geometry).toBe(geometry); expect(s.edge().geometry).toBe(geometry);
    expect(s.renderer.getDebugStats().pool).toBe(64);
    s.renderer.reset(); expect(s.renderer.getDebugStats().pulseTrackers).toBe(0);
    s.update(); expect(s.core().geometry).toBe(geometry);
    s.renderer.dispose(); expect(ownedDispose).toHaveBeenCalledOnce(); expect(borrowedDispose).not.toHaveBeenCalled();
    expect(Array.from(s.bullet.geometry.getAttribute('position').array)).toEqual(original);
  });
});
