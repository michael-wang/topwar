import * as THREE from 'three';
import type { PlayerPresentation } from './squad/PlayerPresentation';
import type { CrowdPresentation } from './enemies/CrowdPresentation';

export type CharacterModel = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
export type CharacterRole = 'player' | 'grunt' | 'heavy' | 'giant' | 'boss';

export interface CharacterParts {
  readonly body: CharacterModel;
  readonly helmet: CharacterModel;
  readonly vest: CharacterModel;
}

// Presentation resources only. Combat truth arrives independently in RenderState.
export interface CharacterVisualFamily<R extends CharacterRole> extends CharacterParts {
  readonly role: R;
  readonly id: string;
}

export interface PlayerVisualFamily extends CharacterVisualFamily<'player'> {
  readonly weapon: CharacterModel;
  readonly presentation: PlayerPresentation;
}

export interface CrowdVisualFamily<R extends 'grunt' | 'heavy' = 'grunt' | 'heavy'> extends CharacterVisualFamily<R> {
  readonly presentation: CrowdPresentation;
  readonly runFrames: readonly CharacterModel[];
  readonly gaitCycleMs: number;
  // Reference feedback parts are independent of the active locomotion pose.
  readonly death: CharacterParts;
  readonly contact: CharacterParts;
}

export interface GiantVisualFamily extends CharacterVisualFamily<'giant'> {
  readonly contactPresentation: CrowdPresentation;
  readonly runFrames: readonly CharacterModel[];
  // Explicit reference contact silhouette; the procedural family includes its maul.
  readonly contact: CharacterParts;
  readonly weapon?: CharacterModel;
  // Character-space grip authored inside the single hand + maul mesh.
  readonly weaponGrip?: readonly [number, number, number];
  // Explicit full motion envelope, including delayed crest and maul motion.
  readonly presentation?: { readonly width: number; readonly height: number; readonly depth: number;
    readonly healthBar?: { readonly width: number; readonly height: number };
    readonly shadow: { readonly width: number; readonly depth: number } };
}

export interface BossVisualFamily extends CharacterVisualFamily<'boss'> {
  readonly runFrames: readonly CharacterModel[];
  readonly slamFrames: readonly CharacterModel[];
  // Boss death retains its active pose and borrows only this material.
  readonly grayBody: CharacterModel;
}

export interface CharacterVisualFamilies {
  readonly player: PlayerVisualFamily;
  readonly grunt: CrowdVisualFamily<'grunt'>;
  readonly heavy: CrowdVisualFamily<'heavy'>;
  readonly giant: GiantVisualFamily;
  readonly boss: BossVisualFamily;
}

export const ENEMY_GAIT_CYCLE_MS = 360;
export const HEAVY_GAIT_CYCLE_MS = 650;

// Sharing a batch is a resource decision, not a role decision. Gait, tint and
// feedback remain per role even when these live instancing resources coincide.
export function canShareCrowdBatch(a: CrowdVisualFamily, b: CrowdVisualFamily): boolean {
  return a.body.material === b.body.material
    && a.presentation.materialStyle === b.presentation.materialStyle
    && a.presentation.bodyTint === b.presentation.bodyTint
    && a.presentation.gearTint === b.presentation.gearTint
    && a.helmet.material === b.helmet.material
    && a.helmet.geometry === b.helmet.geometry && a.vest.geometry === b.vest.geometry
    && a.vest.visible === b.vest.visible
    && a.runFrames.length === b.runFrames.length
    && a.runFrames.every((frame, index) => frame.geometry === b.runFrames[index].geometry);
}
