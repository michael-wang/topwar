import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { publicAssetUrl } from '../core/publicAssetUrl';

export interface CharacterAssets {
  body: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  grayBody: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  runFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[];
  bossSlamFrames: readonly THREE.Mesh<THREE.BufferGeometry, THREE.Material>[];
  playerBody: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  helmet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  vest: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  bossVest: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  rifle: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  bullet: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  dispose(): void;
}

const files = ['body', 'gray-body', 'run-0', 'run-1', 'run-2', 'run-3',
  'player-body', 'helmet', 'vest', 'boss-vest', 'rifle', 'bullet',
  'boss-slam-0', 'boss-slam-1', 'boss-slam-2', 'boss-slam-3'] as const;

export async function loadCharacterAssets(): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const loaded = await Promise.all(files.map((name) =>
    loader.loadAsync(publicAssetUrl(`models/toy-soldier-${name}.glb`))));
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
    body: meshes[0], grayBody: meshes[1], runFrames: meshes.slice(2, 6),
    bossSlamFrames: meshes.slice(12, 16),
    playerBody: meshes[6], helmet: meshes[7],
    vest: meshes[8], bossVest: meshes[9], rifle: meshes[10], bullet: meshes[11],
    dispose(): void {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
