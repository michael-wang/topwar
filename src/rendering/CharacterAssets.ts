import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { publicAssetUrl } from '../core/publicAssetUrl';

export interface CharacterAssets {
  body: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  playerBody: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  helmet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  bossHelmet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  bow: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  arrow: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  dispose(): void;
}

const files = ['body', 'player-body', 'helmet', 'boss-helmet', 'bow', 'arrow'] as const;

export async function loadCharacterAssets(): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const loaded = await Promise.all(files.map((name) =>
    loader.loadAsync(publicAssetUrl(`models/toy-samurai-${name}.glb`))));
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const meshes = loaded.map((gltf, index) => {
    const found: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) throw new Error(`${files[index]} must be static`);
      if (object instanceof THREE.Mesh) found.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>);
    });
    if (found.length !== 1) throw new Error(`${files[index]} must have one mesh; got ${found.length}`);
    const mesh = found[0];
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
    if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map) textures.add(mesh.material.map);
    return mesh;
  });
  return {
    body: meshes[0], playerBody: meshes[1], helmet: meshes[2], bossHelmet: meshes[3],
    bow: meshes[4], arrow: meshes[5],
    dispose(): void {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
