import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { publicAssetUrl } from '../core/publicAssetUrl';
import type { CharacterModel, CharacterVisualFamilies } from './CharacterVisualFamilies';
import { createChibiPlayerFamily } from './squad/ChibiPlayerFamily';
import { createChibiGruntFamily } from './enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from './enemies/ChibiThreatFamilies';

export interface CharacterAssets {
  readonly families: Omit<CharacterVisualFamilies, 'boss'> & Partial<Pick<CharacterVisualFamilies, 'boss'>>;
  readonly rewardHelmet?: CharacterModel;
  readonly bullet: CharacterModel;
  dispose(): void;
}

export const LEGACY_MODEL_FILES = {
  grayIdle: 'gray-body', helmet: 'helmet', bossVest: 'boss-vest', bullet: 'bullet',
  bossSlam0: 'boss-slam-0', bossSlam1: 'boss-slam-1', bossSlam2: 'boss-slam-2', bossSlam3: 'boss-slam-3',
  bossIdle: 'boss-body',
  bossRun0: 'boss-run-0', bossRun1: 'boss-run-1', bossRun2: 'boss-run-2', bossRun3: 'boss-run-3',
} as const;

export async function loadCharacterAssets(includeLegacy = true): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const disposeModels = () => {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  // Defense uses procedural families and no recruitment stream. Only tracers
  // borrow a GLB; the retained bridge mode owns the other twelve resources.
  const files = Object.entries(LEGACY_MODEL_FILES).filter(([key]) => includeLegacy || key === 'bullet');
  const settled = await Promise.allSettled(files.map(async ([key, name]) => {
    const gltf = await loader.loadAsync(publicAssetUrl(`models/toy-soldier-${name}.glb`));
    const found: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
        found.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>);
      }
    });
    if (found.length !== 1) throw new Error(`${name} must have one mesh; got ${found.length}`);
    const mesh = found[0];
    if (mesh instanceof THREE.SkinnedMesh || Array.isArray(mesh.material)) throw new Error(`${name} must be static with one material`);
    return [key, mesh] as const;
  }));
  // Wait for every in-flight parse before releasing resources on partial failure.
  const failure = settled.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') { disposeModels(); throw failure.reason; }
  const entries = settled.map(result => (result as PromiseFulfilledResult<readonly [string, CharacterModel]>).value);
  const resources = Object.fromEntries(entries) as Record<keyof typeof LEGACY_MODEL_FILES, CharacterModel>;
  const player = createChibiPlayerFamily();
  const grunt = createChibiGruntFamily();
  const heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily();
  let disposed = false;
  return {
    families: { player, grunt, heavy, giant, boss: includeLegacy ? {
      role: 'boss', id: 'legacy-boss', body: resources.bossIdle,
      helmet: resources.helmet, vest: resources.bossVest, grayBody: resources.grayIdle,
      runFrames: [resources.bossRun0, resources.bossRun1, resources.bossRun2, resources.bossRun3],
      slamFrames: [resources.bossSlam0, resources.bossSlam1, resources.bossSlam2, resources.bossSlam3],
    } : undefined },
    rewardHelmet: resources.helmet,
    bullet: resources.bullet,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      player.dispose();
      grunt.dispose();
      heavy.dispose(); giant.dispose();
      disposeModels();
    },
  };
}
