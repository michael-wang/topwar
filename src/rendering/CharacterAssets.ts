import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { publicAssetUrl } from '../core/publicAssetUrl';

export interface CharacterAssets {
  soldier: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
  zombie: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  giant: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  dispose(): void;
}

function modelMesh(scene: THREE.Group, name: string): THREE.Mesh<THREE.BufferGeometry> {
  const meshes: THREE.Mesh<THREE.BufferGeometry>[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object instanceof THREE.SkinnedMesh) throw new Error(`${name} must be baked to a rigid mesh`);
      meshes.push(object as THREE.Mesh<THREE.BufferGeometry>);
    }
  });
  if (meshes.length === 1) return meshes[0];
  if (name !== 'soldier.glb' || meshes.length === 0) {
    throw new Error(`${name} must contain exactly one mesh; found ${meshes.length}`);
  }
  const merged = mergeGeometries(meshes.map((mesh) => mesh.geometry), true);
  if (!merged) throw new Error('Could not combine soldier material regions');
  const materials = meshes.map((mesh) => mesh.material).flat();
  return new THREE.Mesh(merged, materials);
}

export async function loadCharacterAssets(): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const paths = ['soldier.glb', 'zombie-basic-static.glb', 'giant.glb'] as const;
  const loaded = await Promise.allSettled(paths.map((path) =>
    loader.loadAsync(publicAssetUrl(`models/${path}`))));
  let mergedSoldierGeometry: THREE.BufferGeometry | null = null;
  const disposeLoaded = (): void => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const result of loaded) {
      if (result.status !== 'fulfilled') continue;
      result.value.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if (material instanceof THREE.MeshStandardMaterial && material.map) textures.add(material.map);
        }
      });
    }
    for (const geometry of geometries) geometry.dispose();
    mergedSoldierGeometry?.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  const failed = loaded.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) {
    disposeLoaded();
    throw new Error('Failed to load character models', { cause: failed.reason });
  }
  try {
    const scenes = loaded.map((result) =>
      (result as PromiseFulfilledResult<Awaited<ReturnType<GLTFLoader['loadAsync']>>>).value.scene);
    const soldier = modelMesh(scenes[0], paths[0]);
    mergedSoldierGeometry = soldier.geometry;
    const zombie = modelMesh(scenes[1], paths[1]);
    const giant = modelMesh(scenes[2], paths[2]);
    return { soldier, zombie: zombie as CharacterAssets['zombie'],
      giant: giant as CharacterAssets['giant'], dispose: disposeLoaded };
  } catch (error) {
    disposeLoaded();
    throw error;
  }
}
