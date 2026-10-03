import * as THREE from 'three';

export type CharacterModel = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
export type CharacterRole = 'player' | 'grunt' | 'heavy' | 'giant' | 'boss';

export interface CharacterParts {
  readonly body: CharacterModel;
  readonly helmet: CharacterModel;
  readonly vest: CharacterModel;
}

// Presentation resources only. Combat truth and scale still arrive in RenderState.
export interface CharacterVisualFamily<R extends CharacterRole> extends CharacterParts {
  readonly role: R;
  readonly id: string;
}

export interface PlayerVisualFamily extends CharacterVisualFamily<'player'> {
  readonly weapon: CharacterModel;
}

export interface CrowdVisualFamily<R extends 'grunt' | 'heavy' = 'grunt' | 'heavy'> extends CharacterVisualFamily<R> {
  readonly runFrames: readonly CharacterModel[];
  readonly gaitCycleMs: number;
  // Legacy feedback uses idle meshes, independently of the active run pose.
  readonly death: CharacterParts;
  readonly contact: CharacterParts;
}

export interface GiantVisualFamily extends CharacterVisualFamily<'giant'> {
  readonly runFrames: readonly CharacterModel[];
  readonly grayBody: CharacterModel;
  // The legacy contact exchange intentionally uses a normal soldier, not the mace hierarchy.
  readonly contact: CharacterParts;
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

export interface LegacyCharacterResources {
  readonly normalIdle: CharacterModel;
  readonly normalRuns: readonly CharacterModel[];
  readonly grayIdle: CharacterModel;
  readonly playerBody: CharacterModel;
  readonly helmet: CharacterModel;
  readonly vest: CharacterModel;
  readonly rifle: CharacterModel;
  readonly bossIdle: CharacterModel;
  readonly bossRuns: readonly CharacterModel[];
  readonly bossSlams: readonly CharacterModel[];
  readonly bossVest: CharacterModel;
}

export const ENEMY_GAIT_CYCLE_MS = 360;
export const HEAVY_GAIT_CYCLE_MS = 650;

export function createLegacyCharacterVisualFamilies(resources: LegacyCharacterResources): CharacterVisualFamilies {
  for (const name of ['normalIdle', 'grayIdle', 'playerBody', 'helmet', 'vest', 'rifle',
    'bossIdle', 'bossVest'] as const) {
    if (!(resources[name] instanceof THREE.Mesh)) throw new Error(`Missing character resource: ${name}`);
  }
  for (const name of ['normalRuns', 'bossRuns', 'bossSlams'] as const) {
    if (resources[name]?.length !== 4 || [0, 1, 2, 3].some(index => !(resources[name][index] instanceof THREE.Mesh))) {
      throw new Error(`Character resource ${name} requires four baked poses`);
    }
  }
  const { normalIdle, normalRuns, grayIdle, helmet, vest } = resources;
  const normal = { body: normalIdle, helmet, vest };
  const gray = { body: grayIdle, helmet, vest };
  return {
    player: { role: 'player', id: 'legacy-player', body: resources.playerBody, helmet, vest,
      weapon: resources.rifle },
    grunt: { role: 'grunt', id: 'legacy-grunt', ...normal, runFrames: normalRuns,
      gaitCycleMs: ENEMY_GAIT_CYCLE_MS, death: { ...gray }, contact: { ...normal } },
    // Borrow raw legacy resources, never the resolved Grunt role. Replacing Grunt
    // later must leave these separate family/feedback records intact.
    heavy: { role: 'heavy', id: 'legacy-heavy', ...normal, runFrames: normalRuns,
      gaitCycleMs: HEAVY_GAIT_CYCLE_MS, death: { ...gray }, contact: { ...normal } },
    giant: { role: 'giant', id: 'legacy-giant', ...normal, runFrames: normalRuns,
      grayBody: grayIdle, contact: { ...normal } },
    boss: { role: 'boss', id: 'legacy-boss', body: resources.bossIdle, helmet,
      vest: resources.bossVest, runFrames: resources.bossRuns, slamFrames: resources.bossSlams,
      grayBody: grayIdle },
  };
}

// Sharing a batch is a resource decision, not a role decision. Gait, tint and
// feedback remain per role even when these live instancing resources coincide.
export function canShareCrowdBatch(a: CrowdVisualFamily, b: CrowdVisualFamily): boolean {
  return a.body.material === b.body.material
    && a.helmet.material === b.helmet.material
    && a.helmet.geometry === b.helmet.geometry && a.vest.geometry === b.vest.geometry
    && a.runFrames.length === b.runFrames.length
    && a.runFrames.every((frame, index) => frame.geometry === b.runFrames[index].geometry);
}
