import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ART } from '../src/art/ArtDirection';
import { CoastalArchitecture } from '../src/rendering/environment/CoastalArchitecture';
import { CoastalWater } from '../src/rendering/environment/CoastalWater';
import { CoastalCloth, coastalCanvasGeometry } from '../src/rendering/environment/CoastalCloth';
import { CoastalVegetation } from '../src/rendering/environment/CoastalVegetation';
import { foliageMassTexture, flowerSpeckTexture } from '../src/rendering/art/FoliageTexture';
import { BridgeEnvironment, BATTLEFIELD_FOG_COLOR, BATTLEFIELD_FOG_NEAR } from '../src/rendering/environment/BridgeEnvironment';

it('switches coastal sky/fog/scenery independently and restores the legacy vista', () => {
  const scene = new THREE.Scene(), environment = new BridgeEnvironment(scene);
  environment.update(80, 3.2, 500, true);
  expect((scene.fog as THREE.Fog).near).toBe(ART.coastalDefense.fogNear);
  expect((scene.background as THREE.Color).getHexString()).toBe('78bde0');
  expect(scene.getObjectByName('enemy-beachhead-horizon')!.visible).toBe(false);
  expect(scene.getObjectByName('battlefield-low-haze')!.visible).toBe(false);
  expect(scene.getObjectByName('stationary-defense-beach')!.position.z).toBe(80);
  environment.update(100, 3.2, 1000, false);
  expect((scene.fog as THREE.Fog).near).toBe(BATTLEFIELD_FOG_NEAR);
  expect((scene.background as THREE.Color).getHexString()).toBe(new THREE.Color(BATTLEFIELD_FOG_COLOR).getHexString());
  expect(scene.getObjectByName('enemy-beachhead-horizon')!.visible).toBe(true);
  expect(scene.getObjectByName('battlefield-low-haze')!.visible).toBe(true);
  expect(scene.getObjectByName('stationary-defense-beach')!.visible).toBe(false);
  environment.dispose(); expect(scene.fog).toBeNull(); expect(scene.background).toBeNull(); expect(scene.children).toHaveLength(0);
});

it('builds repeatable, bounded static architecture without gameplay randomness', () => {
  // Three.js assigns resource UUIDs using Math.random; create them before spying on layout updates.
  const a = new CoastalArchitecture(), b = new CoastalArchitecture();
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('No layout randomness'); });
  a.update(3.2); b.update(3.2);
  const meshes = (root: THREE.Group) => root.children.flatMap(side => side.children) as THREE.Mesh[];
  const left = meshes(a.group), right = meshes(b.group);
  expect(left.length).toBeLessThanOrEqual(18);
  left.forEach((mesh, index) => expect(Array.from(mesh.geometry.getAttribute('position').array))
    .toEqual(Array.from(right[index].geometry.getAttribute('position').array)));
  expect(left.filter(mesh => mesh.name === 'coastal-plaster-forms')).toHaveLength(2);
  expect(left.find(mesh => mesh.name === 'coastal-wallShadow-forms')).toBeDefined();
  random.mockRestore(); a.dispose(); b.dispose();
});

it('keeps hero water anchored at the unchanged shoreline and updates only its presentation clock', () => {
  const water = new CoastalWater(), sea = water.group.getObjectByName('defense-sea') as THREE.Mesh;
  sea.geometry.computeBoundingBox();
  expect(sea.geometry.boundingBox!.min.z + sea.position.z).toBe(53);
  const shader = sea.material as THREE.ShaderMaterial;
  expect(shader.uniforms.aqua.value.getHexString()).toBe('58c8c1');
  expect(shader.uniforms.blue.value.getHexString()).toBe('247e9c');
  expect(shader.toneMapped).toBe(false);
  water.update(2000); expect(shader.uniforms.time.value).toBe(2);
  expect(sea.position.z).toBe(143);
  const dispose = vi.spyOn(shader, 'dispose'); water.dispose(); expect(dispose).toHaveBeenCalledOnce();
});

it('uses two low-segment sagging canvases with independent bounded wind shaders', () => {
  const geometry = coastalCanvasGeometry(3, 2.4), positions = geometry.getAttribute('position');
  expect(positions.count).toBe(36);
  expect(Math.min(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)))).toBeCloseTo(-.36);
  const cloth = new CoastalCloth(); cloth.update(3.2, 1500);
  const canvases = cloth.group.children.filter(mesh => mesh.name === 'wind-coastal-canvas') as THREE.Mesh[];
  expect(canvases).toHaveLength(2);
  const phases: string[] = [];
  for (const canvas of canvases) {
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    (canvas.material as THREE.MeshStandardMaterial).onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
    expect(shader.uniforms).toHaveProperty('canvasTime', { value: 1.5 });
    expect(shader.vertexShader).toContain('freeEdge');
    expect(shader.vertexShader).toMatch(/position.z\+\d+\.\d+\)\/\d+\.\d+/); // GLSL float literals even for whole-number authored dimensions
    phases.push(shader.vertexShader);
  }
  expect(phases[0]).not.toBe(phases[1]); cloth.dispose(); geometry.dispose();
});

it('batches crossed cutout foliage/flowers outside the track without transparent sorting', () => {
  const vegetation = new CoastalVegetation(); vegetation.update(3.2, 1000); vegetation.group.updateMatrixWorld(true);
  let count = 0;
  for (const side of vegetation.group.children) {
    const crowns = side.children.filter(mesh => mesh.name === 'coastal-leafy-masses') as THREE.InstancedMesh[];
    expect(crowns).toHaveLength(1);
    expect(crowns[0].geometry.type).toBe('PlaneGeometry');
    const material = crowns[0].material as THREE.MeshBasicMaterial;
    expect(material.alphaTest).toBe(.4);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.map).toBeDefined();
    const rotations = Array.from({ length: 4 }, (_, i) => {
      const matrix = new THREE.Matrix4(); crowns[0].getMatrixAt(i, matrix);
      return new THREE.Euler().setFromRotationMatrix(matrix).y;
    });
    expect(new Set(rotations).size).toBe(4);
    for (const mesh of side.children as THREE.InstancedMesh[]) {
      count += mesh.count;
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i++) {
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
        const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
        expect(bounds.min.x > 3.2 || bounds.max.x < -3.2).toBe(true);
      }
    }
  }
  expect(count).toBeLessThan(80); vegetation.dispose();
});

it('generates repeatable porous foliage with transparent borders and releases the shared texture', () => {
  const a = foliageMassTexture(), b = foliageMassTexture();
  expect(a.image.data).toEqual(b.image.data);
  const { width, height, data } = a.image;
  const alphas = Array.from({ length: width * height }, (_, i) => data[i * 4 + 3]);
  expect(alphas.filter(alpha => alpha > 128).length).toBeGreaterThan(width * height * .25);
  expect(alphas.filter(alpha => alpha === 0).length).toBeGreaterThan(width * height * .3);
  for (let x = 0; x < width; x++) {
    expect(data[x * 4 + 3]).toBe(0);
    expect(data[((height - 1) * width + x) * 4 + 3]).toBe(0);
  }
  expect(a.colorSpace).toBe(THREE.SRGBColorSpace);
  const vegetation = new CoastalVegetation();
  const mesh = vegetation.group.children[0].getObjectByName('coastal-leafy-masses') as THREE.InstancedMesh;
  const texture = (mesh.material as THREE.MeshBasicMaterial).map!;
  const dispose = vi.spyOn(texture, 'dispose');
  vegetation.dispose(); expect(dispose).toHaveBeenCalledOnce();
  a.dispose(); b.dispose();
});

it('keeps sparse tiny blossoms on vine cards instead of helmet-sized geometric masses', () => {
  const texture = flowerSpeckTexture();
  const data = texture.image.data;
  const opaque = Array.from({ length: texture.image.width * texture.image.height }, (_, i) => data[i * 4 + 3])
    .filter(alpha => alpha > 128).length;
  expect(opaque).toBeGreaterThan(100);
  expect(opaque).toBeLessThan(texture.image.width * texture.image.height * .04);
  const vegetation = new CoastalVegetation();
  const flowers = vegetation.group.children[0].getObjectByName('side-flower-masses') as THREE.InstancedMesh;
  expect(flowers.geometry.type).toBe('PlaneGeometry');
  expect((flowers.material as THREE.MeshBasicMaterial).alphaTest).toBe(.4);
  const dispose = vi.spyOn((flowers.material as THREE.MeshBasicMaterial).map!, 'dispose');
  vegetation.dispose(); expect(dispose).toHaveBeenCalledOnce(); texture.dispose();
});
