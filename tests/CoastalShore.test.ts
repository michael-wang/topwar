import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { ART } from '../src/art/ArtDirection';
import { COASTAL_SHORE as S, COASTAL_SURF, travellingSurfFront, visualShoreOffset } from '../src/rendering/environment/CoastalShore';
import { CoastalWater } from '../src/rendering/environment/CoastalWater';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

it('covers the full irregular wet-sand/tide envelope with a narrow two-triangle overlay', () => {
  const water = new CoastalWater(), shore = water.group.getObjectByName('coastal-wet-sand-and-surf') as THREE.Mesh;
  shore.geometry.computeBoundingBox();
  const bounds = shore.geometry.boundingBox!;
  expect(shore.geometry.index!.count).toBe(6);
  expect(shore.position.z).toBe(ART.coastalDefense.shorelineZ);
  expect(bounds.min.z).toBe(-S.beachReach); expect(bounds.max.z).toBe(S.seaReach);
  for (let x = -120; x <= 120; x += .5) for (let t = 0; t <= 12000; t += 400) {
    const edge = visualShoreOffset(x, t);
    expect(Math.abs(edge)).toBeLessThanOrEqual(S.spatialAmplitude + S.secondaryAmplitude + S.tideAmplitude);
    expect(edge - S.wetWidth).toBeGreaterThan(bounds.min.z);
    expect(edge + 1.8).toBeLessThan(bounds.max.z);
    expect(Math.abs(edge - visualShoreOffset(x, 0))).toBeLessThanOrEqual(2 * S.tideAmplitude);
    expect(visualShoreOffset(x, t + S.tidePeriodSeconds * 1000)).toBeCloseTo(edge);
  }
  expect(S.spatialAmplitude + S.secondaryAmplitude).toBeCloseTo(1.1);
  expect(S.tideAmplitude).toBe(.4); expect(S.tidePeriodSeconds).toBe(12);
  const shader = shore.material as THREE.ShaderMaterial;
  expect(shader.defines).toHaveProperty('SHORE_OVERLAY'); expect(shader.transparent).toBe(true);
  expect(shader.depthWrite).toBe(false); expect(shader.uniforms.wetSand.value.getHexString()).toBe('b3ad97');
  water.dispose();
});

it('shares restrained shallow-only light and depth colors across the two cheap water passes', () => {
  const water = new CoastalWater();
  const sea = water.group.getObjectByName('defense-sea') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const shore = water.group.getObjectByName('coastal-wet-sand-and-surf') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  expect(sea.material.uniforms).toBe(shore.material.uniforms);
  expect(sea.material.fragmentShader).toBe(shore.material.fragmentShader);
  expect(sea.material.uniforms.clearAqua.value.getHexString()).toBe('9bded0');
  expect(sea.material.uniforms.middleBlue.value.getHexString()).toBe('389eaf');
  expect(sea.geometry.index!.count).toBe(6);
  expect(sea.material.fragmentShader).toContain('smoothstep(5.,24.,depth)');
  expect(sea.material.fragmentShader).not.toContain('pow(');
  expect(Object.values(sea.material.uniforms).some(u => u.value instanceof THREE.Texture)).toBe(false);
  water.dispose();
});

it('rewinds only presentation uniforms and disposes every owned shore/sea/sky resource', () => {
  const water = new CoastalWater();
  const meshes = water.group.children.filter(o => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) as THREE.Mesh[];
  const snapshots = meshes.map(m => ({ position: m.position.clone(), vertices: Array.from(m.geometry.getAttribute('position').array) }));
  const disposals = meshes.flatMap(m => [vi.spyOn(m.geometry, 'dispose'), vi.spyOn(m.material as THREE.Material, 'dispose')]);
  water.update(12000); water.update(0);
  meshes.forEach((m, i) => {
    expect(m.position).toEqual(snapshots[i].position);
    expect(Array.from(m.geometry.getAttribute('position').array)).toEqual(snapshots[i].vertices);
    expect((m.material as THREE.ShaderMaterial).uniforms.time?.value ?? 0).toBe(0);
  });
  water.dispose(); disposals.forEach(d => expect(d).toHaveBeenCalledOnce());
});

it('removes redundant static defense foam without removing legacy ocean or transports', () => {
  const scene = new THREE.Scene(), environment = new BridgeEnvironment(scene);
  environment.update(0, 3.2, 3000, true);
  expect(scene.getObjectsByProperty('name', 'shoreline-foam')).toHaveLength(0);
  expect(scene.getObjectByName('coastal-wet-sand-and-surf')).toBeDefined();
  expect(scene.getObjectByName('offshore-troop-transports')).toBeDefined();
  environment.update(0, 3.2, 3000, false);
  expect(scene.getObjectByName('bridge-ocean')!.visible).toBe(true);
  expect(scene.getObjectByName('stationary-defense-beach')!.visible).toBe(false);
  environment.dispose(); expect(scene.children).toHaveLength(0);
});

it('travels two staggered bounded surf fronts shoreward with deterministic rewind', () => {
  expect(COASTAL_SURF.frontCount).toBe(2);
  expect(COASTAL_SURF.cycleSeconds / COASTAL_SURF.frontCount).toBe(3.2);
  expect(COASTAL_SURF.startOffset - COASTAL_SURF.endOffset).toBe(2.5);
  for (let x = -120; x <= 120; x += 2) for (let time = 0; time < 12800; time += 100) for (const front of [0, 1] as const) {
    const wave = travellingSurfFront(x, time, front);
    expect(wave.center).toBeGreaterThanOrEqual(-.25); expect(wave.center).toBeLessThanOrEqual(2.25);
    expect(wave.width).toBeGreaterThanOrEqual(.40); expect(wave.width).toBeLessThanOrEqual(.80);
    expect(wave.envelope).toBeGreaterThanOrEqual(0); expect(wave.envelope).toBeLessThanOrEqual(1);
    expect(wave.center + visualShoreOffset(x, time)).toBeLessThan(S.seaReach);
    expect(wave.center + visualShoreOffset(x, time)).toBeGreaterThan(-S.beachReach);
    expect(travellingSurfFront(x, time + 6400, front).center).toBeCloseTo(wave.center);
  }
  const early = travellingSurfFront(0, 800, 0), middle = travellingSurfFront(0, 2400, 0), late = travellingSurfFront(0, 4200, 0);
  expect(early.center).toBeGreaterThan(middle.center); expect(middle.center).toBeGreaterThan(late.center);
  expect(late.width).toBeGreaterThan(early.width);
  expect(early.envelope).toBeGreaterThan(.5); expect(travellingSurfFront(0, 5900, 0).envelope).toBe(0);
});
