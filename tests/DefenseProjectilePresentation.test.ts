import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { ProjectileRenderer } from '../src/rendering/projectiles/ProjectileRenderer';
import { coastalCameraFov } from '../src/rendering/renderSize';
import acceptedMatrices from './fixtures/accepted-p3-matrices.json';

function setup(width = 350, height = 844) {
  const scene = new THREE.Scene();
  const bullet = new THREE.Mesh(new THREE.BoxGeometry(.052, .052, .52), new THREE.MeshBasicMaterial());
  const renderer = new ProjectileRenderer(scene, { height: .37145, offsetX: 0 });
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

describe('Thin cinematic white/ivory Defense tracer trial', () => {
  it('preserves the previous tracer anchors and orientations while reducing width across mobile sizes, slopes, depths and muzzle ages', () => {
    for (const row of acceptedMatrices) {
      const s = setup(row.width);
      s.shot.z = row.z; s.shot.slopeX = row.slope;
      s.update(0); s.update(row.time);
      for (const [mesh, expected] of [[s.core(), row.core], [s.edge(), row.edge]] as const) {
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
        expect(matrix.elements.slice(12,15)).toEqual(expected.slice(12,15));
        const old=new THREE.Matrix4().fromArray(expected),scale=new THREE.Vector3().setFromMatrixScale(matrix),previous=new THREE.Vector3().setFromMatrixScale(old);
        expect(scale.x).toBeLessThan(previous.x*.6);
        for(const column of [0,2])expect(new THREE.Vector3().setFromMatrixColumn(matrix,column).normalize().distanceTo(new THREE.Vector3().setFromMatrixColumn(old,column).normalize())).toBeLessThan(1e-6);
      }
      s.renderer.dispose();
    }
  });

  it('uses the exact selected colors, geometry and size constants without a DEV override', () => {
    const s = setup(); s.update(0); s.update();
    expect(ART.defenseTracer).toEqual({ core: '#fffaf0', outline: '#e7e8e2', coreLengthRatio: .9,
      corePixels: .85, outlinePixels: .2, lengthPixels: 12, minCoreWidth: .014, maxCoreWidth: .07, maxOutlineWidth: .016, maxLength: 1.1 });
    expect(Array.from(s.core().geometry.getAttribute('position').array)).toEqual(Array.from(new Float32Array([
      0,0,0, -.5,0,-.08, -.42,0,-.72, 0,0,-1, .42,0,-.72, .5,0,-.08,
    ])));
    expect(Array.from(s.core().geometry.index!.array)).toEqual([0,1,2,0,2,3,0,3,4,0,4,5]);
    const core = s.core().material as THREE.MeshBasicMaterial, edge = s.edge().material as THREE.MeshBasicMaterial;
    expect(core.color.getHexString()).toBe('fffaf0'); expect(edge.color.getHexString()).toBe('e7e8e2');
    expect(core.transparent).toBe(true); expect(core.opacity).toBe(1); expect(edge.opacity).toBe(1);
    expect(edge.depthWrite).toBe(false); expect(core.depthTest).toBe(true);
    expect(s.core().renderOrder).toBeGreaterThan(s.edge().renderOrder);
    expect(s.core().renderOrder).toBeLessThan(10); // Enemy HP indicators.
    s.renderer.dispose();
  });

  it.each([350,390])('retains ground-aligned bounded tails at %i px', width => {
    const s = setup(width); s.update(0);
    for (const z of [20,30,40]) {
      s.shot.z=z;s.update();
      expect(s.pixels(s.core()).width).toBeGreaterThanOrEqual(.85-1e-5);
      expect(s.pixels(s.edge()).width).toBeLessThan(1.2);
      expect(s.pixels(s.edge()).length).toBeGreaterThan(12);
      expect(s.pixels(s.edge()).length).toBeLessThan(15);
      for(const mesh of [s.core(),s.edge()]) for(const v of s.vertices(mesh)) expect(v.y).toBeCloseTo(.37145,5);
    }
    s.shot.z=150;s.update();
    const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();s.core().getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(.07);expect(scale.z).toBeLessThanOrEqual(8*.9+1e-6);
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

  it('retains stable colors/blending, resets for Retry, and keeps the accepted materials/geometry', () => {
    const s = setup(); s.update(0); s.update(); const ordinary = s.pixels(s.edge()).width;
    s.update(200);
    expect(s.pixels(s.core()).width).toBeGreaterThanOrEqual(.85-1e-5);
    expect(s.pixels(s.edge()).width).toBeCloseTo(ordinary);
    expect((s.edge().material as THREE.MeshBasicMaterial).blending).toBe(THREE.NormalBlending);
    s.renderer.reset(); s.update(300);
    expect((s.edge().material as THREE.MeshBasicMaterial).color.getHexString()).toBe('e7e8e2');
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
