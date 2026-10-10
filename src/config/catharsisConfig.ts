import { z } from 'zod';
import { ArtilleryConfigSchema } from './artilleryConfig';
import { DestroyerConfigSchema } from './destroyerConfig';
import { GrenadeConfigSchema, grenadeDefaults } from './grenadeConfig';
import { ProgressionConfigSchema, progressionDefaults } from './progressionConfig';
import { PostCapSurvivalConfigSchema, postCapSurvivalDefaults } from './postCapSurvivalConfig';
import { CarnivalConfigSchema, carnivalDefaults } from './carnivalConfig';
import { DefenseWaveConfigSchema, defenseWaveDefaults, LEGACY_DEFENSE_FORWARD_SPEED } from './defenseConfig';

const pressureRampStage = z.strictObject({
  xpFraction: z.number().finite().gt(0).lt(1),
  pressureLaneCount: z.number().int().min(1).max(16),
  heavyChance: z.number().finite().min(0).max(1).optional(),
  heavyCount: z.number().int().min(0).max(100).optional(),
}).refine(stage => (stage.heavyChance === undefined) !== (stage.heavyCount === undefined),
  { message: 'Author exactly one Heavy composition rule' });

// Temporary lane experiment, separate from the retained tier/Boss balance.
export const CatharsisConfigSchema = z.strictObject({
  destroyer: DestroyerConfigSchema.optional(),
  artillery: ArtilleryConfigSchema.optional(),
  defenseMotionVersion: z.literal(2).optional(),
  defenseWaves: DefenseWaveConfigSchema.default(defenseWaveDefaults),
  carnival: CarnivalConfigSchema.default(carnivalDefaults),
  postCapSurvival: PostCapSurvivalConfigSchema.default(postCapSurvivalDefaults),
  // Missing Grenade configuration belongs to historical one-hit snapshots.
  grenade: GrenadeConfigSchema.default({ ...grenadeDefaults, supplyHitsRequired: 1, supplyDestruction: undefined }),
  machineGun: z.strictObject({
    fireRate: z.number().finite().positive().default(18),
    projectileSpeed: z.number().finite().positive().default(60),
    range: z.number().finite().positive().default(80),
    damageEnemyHp: z.number().finite().positive().default(1),
  }).default({ fireRate: 18, projectileSpeed: 60, range: 80, damageEnemyHp: 1 }),
  progression: ProgressionConfigSchema.default(progressionDefaults),
  landingAssault: z.strictObject({
    enabled: z.boolean().default(false),
    powerWindowSeconds: z.number().finite().nonnegative().default(10),
    groupSize: z.number().int().min(1).max(200).default(66),
    cadenceMultiplier: z.number().finite().positive().default(.88),
    primaryLaneShare: z.number().finite().min(.5).max(.9).default(.7),
    heavyMultiplier: z.number().finite().min(1).max(3).default(1.3),
    heavyChanceCap: z.number().finite().min(0).max(1).default(.85),
    activeSoftCap: z.number().int().positive().default(180),
    secondGiantDelaySeconds: z.number().finite().positive().default(30),
    giantFollowupDelaySeconds: z.number().finite().positive().default(10),
    maxSimultaneousGiants: z.number().int().min(1).max(2).default(1),
  }).default({ enabled: false, powerWindowSeconds: 10, groupSize: 66, cadenceMultiplier: .88,
    primaryLaneShare: .7, heavyMultiplier: 1.3, heavyChanceCap: .85, activeSoftCap: 180,
    secondGiantDelaySeconds: 30, giantFollowupDelaySeconds: 10, maxSimultaneousGiants: 1 }),
  pressureMultipliers: z.array(z.number().finite().min(1).max(4)).min(1).default([1, 1, 1, 1, 1.25, 1.35, 1.45, 1.55, 1.6, 1.65]),
  giant: z.strictObject({
    enabled: z.boolean().default(false),
    unlockLevel: z.number().int().min(4).default(7),
    introDelaySeconds: z.number().finite().nonnegative().default(4),
    hp: z.number().finite().positive().default(210),
    xp: z.number().int().nonnegative().default(120),
    speed: z.number().finite().nonnegative().default(.08),
    // Render projection only: the compressed Heavy makes 1.9 the 2.18× crown target.
    visualScale: z.number().finite().min(1.8).max(5).default(1.9),
    widthMultiplier: z.number().finite().positive().default(.94),
    gaitCycleMs: z.number().finite().positive().default(850),
  }).default({ enabled: false, unlockLevel: 7, introDelaySeconds: 4, hp: 210, xp: 120,
    speed: .08, visualScale: 1.9, widthMultiplier: .94, gaitCycleMs: 850 }),
  heavyFrontClearance: z.number().finite().nonnegative().default(2.5),
  defenseMode: z.boolean().default(false),
  defenseSpawnAheadDistance: z.number().finite().positive().default(47),
  crowdDepthSpan: z.number().finite().positive().default(5),
  laneSwitchSeconds: z.number().finite().positive().default(.15),
  lateralSpreadFraction: z.number().finite().min(0).max(.45).default(.26),
  memberDepthSpacing: z.number().finite().positive().default(.85),
  depthJitter: z.number().finite().nonnegative().default(.35),
  laneCount: z.number().int().min(3).max(16),
  edgeInset: z.number().finite().positive(),
  waveRows: z.number().int().min(2),
  priorityWaves: z.number().int().min(1).max(10),
  // Absent in older snapshots: retain their one/two-front composition path.
  pressureLaneCount: z.number().int().min(1).max(16).optional(),
  // Optional so older snapshots retain their original future-wave behavior.
  pressureRamp: z.strictObject({ lv4: pressureRampStage, lv5: pressureRampStage,
    lv6: z.strictObject({ groupSize: z.number().int().min(1).max(100),
      pressureLaneCount: z.number().int().min(1).max(16),
      heavyCount: z.number().int().min(0).max(100) }).optional(),
  }).optional(),
  groupSize: z.number().int().min(1).max(100),
  groupRowStride: z.number().int().positive(),
  secondLaneChance: z.number().min(0).max(1),
  heavyChance: z.number().min(0).max(1),
  gruntSpeed: z.number().finite().nonnegative(),
  heavySpeed: z.number().finite().nonnegative(),
  heavyHp: z.number().finite().gt(1),
  enemyVisualScale: z.number().finite().positive(),
  heavyVisualScale: z.number().finite().gt(1),
  heavyWidthMultiplier: z.number().finite().positive().max(2).default(1),
  heavyHeightMultiplier: z.number().finite().positive().max(2).default(1),
  heavyDepthMultiplier: z.number().finite().positive().max(2).default(1),
  rewardAimRadius: z.number().finite().positive(),
}).refine(value => !value.carnival.enabled || value.carnival.laneGroups.every(lanes => lanes.every(lane => lane < value.laneCount)),
  { message: 'Carnival lanes must fit inside the battlefield' })
  .refine((value) => value.defenseMode || (value.groupSize - 1) * value.groupRowStride < value.waveRows,
  { message: 'Group must fit inside one wave' })
  .refine(value => value.landingAssault.groupSize <= value.landingAssault.activeSoftCap,
    { message: 'Landing group must fit inside the active soft cap' })
  .refine(value => value.pressureLaneCount === undefined || value.pressureLaneCount <= value.laneCount,
    { message: 'Pressure lane count must fit inside the battlefield' })
  .refine(value => !value.pressureRamp || [value.pressureRamp.lv4, value.pressureRamp.lv5]
    .every(stage => stage.pressureLaneCount <= value.laneCount)
    && (!value.pressureRamp.lv6 || value.pressureRamp.lv6.pressureLaneCount <= value.laneCount),
    { message: 'Pressure ramp fronts must fit inside the battlefield' })
  .refine(value => !value.postCapSurvival.enabled || value.postCapSurvival.pressureLaneCount <= value.laneCount,
    { message: 'Post-cap fronts must fit inside the battlefield' })
  .refine(value => !value.pressureRamp || [value.pressureRamp.lv4, value.pressureRamp.lv5].every((stage, index) =>
    (stage.heavyCount ?? 0) <= Math.round(value.groupSize * value.pressureMultipliers[Math.min(index + 3, value.pressureMultipliers.length - 1)]))
    && (!value.pressureRamp.lv6 || value.pressureRamp.lv6.heavyCount <= value.pressureRamp.lv6.groupSize),
    { message: 'Heavy count must fit inside its group population' })
  .transform(value => value.defenseMode && value.defenseMotionVersion === undefined ? {
    ...value, defenseMotionVersion: 2 as const,
    gruntSpeed: value.gruntSpeed + LEGACY_DEFENSE_FORWARD_SPEED,
    heavySpeed: value.heavySpeed + LEGACY_DEFENSE_FORWARD_SPEED,
    giant: { ...value.giant, speed: value.giant.speed + LEGACY_DEFENSE_FORWARD_SPEED },
  } : value);

export type CatharsisConfig = z.infer<typeof CatharsisConfigSchema>;
