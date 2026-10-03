import * as THREE from 'three';
import { createLegacyCharacterVisualFamilies, type CharacterModel, type LegacyCharacterResources } from '../src/rendering/CharacterVisualFamilies';

export function characterFamilies(overrides: Partial<LegacyCharacterResources> = {}) {
  return createLegacyCharacterVisualFamilies({ normalIdle: bodyModel(), normalRuns: runFrames(),
    grayIdle: grayBodyModel(), playerBody: bodyModel(), helmet: helmetModel(), vest: vestModel(),
    rifle: rifleModel(), bossIdle: bodyModel(), bossRuns: runFrames(), bossSlams: runFrames(),
    bossVest: vestModel(), ...overrides });
}

export function playerFamily(body: CharacterModel, helmet: CharacterModel, vest: CharacterModel, weapon: CharacterModel) {
  return characterFamilies({ playerBody: body, helmet, vest, rifle: weapon }).player;
}

export function enemyFamilies(body: CharacterModel, helmet: CharacterModel, vest: CharacterModel,
  frames: readonly CharacterModel[], gray: CharacterModel) {
  return characterFamilies({ normalIdle: body, helmet, vest, normalRuns: frames, grayIdle: gray });
}

export function giantFamily(body: CharacterModel, helmet: CharacterModel, vest: CharacterModel,
  frames: readonly CharacterModel[], gray: CharacterModel) {
  return enemyFamilies(body, helmet, vest, frames, gray).giant;
}

export function bossFamily(body: CharacterModel, helmet: CharacterModel, vest: CharacterModel,
  runs: readonly CharacterModel[], slams: readonly CharacterModel[], gray: CharacterModel) {
  return characterFamilies({ bossIdle: body, helmet, bossVest: vest, bossRuns: runs,
    bossSlams: slams, grayIdle: gray }).boss;
}

export function bodyModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: '#d8a275' });
  material.name = 'fixed-body';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function grayBodyModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#aeb4b7' }));
}
export function runFrames(): THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] {
  return Array.from({ length: 4 }, () => bodyModel());
}
export function helmetModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: 'white' });
  material.name = 'armor';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function vestModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return helmetModel();
}
export function rifleModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const material = new THREE.MeshStandardMaterial({ color: '#30353a' });
  material.name = 'rifle';
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}
export function bulletModel(): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return new THREE.Mesh(new THREE.ConeGeometry(.1, .5, 5),
    new THREE.MeshStandardMaterial({ color: '#f2c750' }));
}
