import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { publicAssetUrl } from '../core/publicAssetUrl';
import { createCharacterVisualFamilies, type CharacterModel, type CharacterVisualFamilies } from './CharacterVisualFamilies';
import { createChibiPlayerFamily } from './squad/ChibiPlayerFamily';

export interface CharacterAssets {
  readonly families: CharacterVisualFamilies;
  readonly rewardHelmet: CharacterModel;
  readonly bullet: CharacterModel;
  dispose(): void;
}

const files = {
  normalIdle: 'body', grayIdle: 'gray-body',
  normalRun0: 'run-0', normalRun1: 'run-1', normalRun2: 'run-2', normalRun3: 'run-3',
  helmet: 'helmet', vest: 'vest', bossVest: 'boss-vest', bullet: 'bullet',
  bossSlam0: 'boss-slam-0', bossSlam1: 'boss-slam-1', bossSlam2: 'boss-slam-2', bossSlam3: 'boss-slam-3',
  bossIdle: 'boss-body',
  bossRun0: 'boss-run-0', bossRun1: 'boss-run-1', bossRun2: 'boss-run-2', bossRun3: 'boss-run-3',
} as const;

export async function loadCharacterAssets(): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const entries = await Promise.all(Object.entries(files).map(async ([key, name]) => {
    const gltf = await loader.loadAsync(publicAssetUrl(`models/toy-soldier-${name}.glb`));
    const found: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) throw new Error(`${name} must be static`);
      if (object instanceof THREE.Mesh) found.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>);
    });
    if (found.length !== 1) throw new Error(`${name} must have one mesh; got ${found.length}`);
    const mesh = found[0];
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
    if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map) textures.add(mesh.material.map);
    return [key, mesh] as const;
  }));
  const resources = Object.fromEntries(entries) as Record<keyof typeof files, CharacterModel>;
  const player = createChibiPlayerFamily();
  return {
    families: createCharacterVisualFamilies({
      ...resources,
      normalRuns: [resources.normalRun0, resources.normalRun1, resources.normalRun2, resources.normalRun3],
      bossRuns: [resources.bossRun0, resources.bossRun1, resources.bossRun2, resources.bossRun3],
      bossSlams: [resources.bossSlam0, resources.bossSlam1, resources.bossSlam2, resources.bossSlam3],
    }, player),
    rewardHelmet: resources.helmet,
    bullet: resources.bullet,
    dispose(): void {
      player.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
