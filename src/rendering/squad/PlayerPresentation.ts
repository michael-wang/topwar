import * as THREE from 'three';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { PlayerBodyMotion } from './PlayerBodyMotion';

export interface PlayerMotion {
  readonly normal: THREE.MeshStandardMaterial;
  readonly level: THREE.MeshStandardMaterial;
  update(stride: number, recoil: number, glow: number, ready: number): void;
  dispose(): void;
}

export interface PlayerPresentation {
  readonly rootScale: number;
  readonly createMotion: (normal: THREE.MeshStandardMaterial, level: THREE.MeshStandardMaterial) => PlayerMotion;
  readonly prepareMaterial: (material: THREE.MeshStandardMaterial, surface: 'body' | 'gear' | 'weapon') => THREE.MeshStandardMaterial;
  readonly weaponPosition: readonly [number, number, number];
  readonly muzzleAnchor: readonly [number, number, number];
  readonly shadow: { readonly width: number; readonly depth: number };
  readonly levelUp: { readonly radius: number; readonly height: number };
  readonly tracer: { readonly height: number; readonly offsetX: number };
}

// Explicit rollback/test adapter. New Player geometry never uses this motion or UV paint path.
export const LEGACY_PLAYER_PRESENTATION: PlayerPresentation = {
  rootScale: .85,
  createMotion: (normal, level) => new PlayerBodyMotion(normal, level),
  prepareMaterial: (material, surface) => illustratedMaterial(material,
    surface === 'body' ? 'player' : surface === 'weapon' ? 'weapon' : 'world'),
  weaponPosition: [.13, 0, 0],
  muzzleAnchor: [.25, .46, .93],
  shadow: { width: .72, depth: .43 },
  levelUp: { radius: .49, height: 1.1 },
  tracer: { height: .64, offsetX: 0 },
};
