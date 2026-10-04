import * as THREE from 'three';
import type { CharacterModel, CharacterVisualFamilies } from '../src/rendering/CharacterVisualFamilies';
import { ChibiPlayerMotion } from '../src/rendering/squad/ChibiPlayerMotion';
import type { PlayerPresentation } from '../src/rendering/squad/PlayerPresentation';
import type { CrowdPresentation } from '../src/rendering/enemies/CrowdPresentation';

// Synthetic resources exercise renderer ownership/pooling independently of authored art.
interface TestResources {
  normalIdle: CharacterModel; normalRuns: readonly CharacterModel[]; grayIdle: CharacterModel;
  playerBody: CharacterModel; helmet: CharacterModel; vest: CharacterModel; rifle: CharacterModel;
  bossIdle: CharacterModel; bossRuns: readonly CharacterModel[]; bossSlams: readonly CharacterModel[]; bossVest: CharacterModel;
}
const playerPresentation: PlayerPresentation = {
  rootScale: .85, createMotion: (normal,level) => new ChibiPlayerMotion(normal,level,new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()),
  prepareMaterial: material => material, weaponPosition: [.13,0,0], muzzleAnchor: [.25,.46,.93],
  shadow: {width:.72,depth:.43}, levelUp: {radius:.49,height:1.1}, tracer: {height:.64,offsetX:0},
};
const crowdPresentation: CrowdPresentation = {materialStyle:'legacy-atlas',bodyTint:'legacy-tunic'};
export function characterFamilies(overrides: Partial<TestResources> = {}): CharacterVisualFamilies {
  const r = {normalIdle:bodyModel(),normalRuns:runFrames(),grayIdle:grayBodyModel(),playerBody:bodyModel(),
    helmet:helmetModel(),vest:vestModel(),rifle:rifleModel(),bossIdle:bodyModel(),bossRuns:runFrames(),bossSlams:runFrames(),bossVest:vestModel(),...overrides};
  const normal={body:r.normalIdle,helmet:r.helmet,vest:r.vest},gray={...normal,body:r.grayIdle};
  return {
    player:{role:'player',id:'test-player',body:r.playerBody,helmet:r.helmet,vest:r.vest,weapon:r.rifle,presentation:playerPresentation},
    grunt:{role:'grunt',id:'test-grunt',...normal,runFrames:r.normalRuns,presentation:crowdPresentation,gaitCycleMs:360,death:gray,contact:normal},
    heavy:{role:'heavy',id:'test-heavy',...normal,runFrames:r.normalRuns,presentation:crowdPresentation,gaitCycleMs:650,death:{...gray},contact:{...normal}},
    giant:{role:'giant',id:'test-giant',...normal,runFrames:r.normalRuns,contactPresentation:crowdPresentation,contact:{...normal}},
    boss:{role:'boss',id:'test-boss',body:r.bossIdle,helmet:r.helmet,vest:r.bossVest,runFrames:r.bossRuns,slamFrames:r.bossSlams,grayBody:r.grayIdle},
  };
}
export function playerFamily(body:CharacterModel,helmet:CharacterModel,vest:CharacterModel,weapon:CharacterModel){return characterFamilies({playerBody:body,helmet,vest,rifle:weapon}).player;}
export function enemyFamilies(body:CharacterModel,helmet:CharacterModel,vest:CharacterModel,frames:readonly CharacterModel[],gray:CharacterModel){return characterFamilies({normalIdle:body,helmet,vest,normalRuns:frames,grayIdle:gray});}
export function bossFamily(body:CharacterModel,helmet:CharacterModel,vest:CharacterModel,runs:readonly CharacterModel[],slams:readonly CharacterModel[],gray:CharacterModel){return characterFamilies({bossIdle:body,helmet,bossVest:vest,bossRuns:runs,bossSlams:slams,grayIdle:gray}).boss;}

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
