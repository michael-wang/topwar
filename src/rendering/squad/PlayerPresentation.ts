import * as THREE from 'three';

export interface PlayerMotion {
  readonly normal: THREE.MeshStandardMaterial;
  readonly level: THREE.MeshStandardMaterial;
  update(stride: number, recoil: number, glow: number, ready: number, weaponTransform?: THREE.Matrix4): void;
  dispose(): void;
}

export interface PlayerPresentation {
  readonly rootScale: number;
  readonly createMotion: (normal: THREE.MeshStandardMaterial, level: THREE.MeshStandardMaterial) => PlayerMotion;
  readonly prepareMaterial: (material: THREE.MeshStandardMaterial, surface: 'body' | 'gear' | 'weapon') => THREE.MeshStandardMaterial;
  readonly weaponPosition: readonly [number, number, number];
  readonly weaponRotation?: readonly [number, number, number];
  readonly muzzleAnchor: readonly [number, number, number];
  readonly shadow: { readonly width: number; readonly depth: number };
  readonly levelUp: { readonly radius: number; readonly height: number };
  readonly tracer: { readonly height: number; readonly offsetX: number };
}
