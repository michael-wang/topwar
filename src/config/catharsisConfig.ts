import { z } from 'zod';

// Temporary lane experiment, separate from the retained tier/Boss balance.
export const CatharsisConfigSchema = z.strictObject({
  progression: z.strictObject({
    xpRequirements: z.array(z.number().int().positive()).length(4).default([28, 60, 110, 180]),
    levelPlan: z.array(z.strictObject({
      fireRateStage: z.number().int().min(1).max(3),
      squadStage: z.number().int().min(1).max(3),
    })).length(5).default([
      { fireRateStage: 1, squadStage: 1 }, { fireRateStage: 2, squadStage: 1 },
      { fireRateStage: 3, squadStage: 1 }, { fireRateStage: 3, squadStage: 2 },
      { fireRateStage: 3, squadStage: 3 },
    ]),
    fireRateMultipliers: z.array(z.number().finite().positive()).length(3).default([1, 1.25, 1.5]),
    gruntKillXp: z.number().int().nonnegative().default(1),
    heavyKillXp: z.number().int().nonnegative().default(10),
    // Deferred late-game entrance/assault only; natural P1 progression cannot reach it.
    reinforcementLevel: z.number().int().min(6).default(7),
    reinforcementArrivalSeconds: z.number().finite().positive().default(1.1),
    reinforcementSpacing: z.number().finite().positive().default(.72),
    reinforcementStagger: z.number().finite().nonnegative().default(.18),
  }).refine(value => value.levelPlan[0].fireRateStage === 1 && value.levelPlan[0].squadStage === 1
    && value.levelPlan.every((stage, index) => index === 0
      || (stage.fireRateStage >= value.levelPlan[index - 1].fireRateStage
        && stage.squadStage >= value.levelPlan[index - 1].squadStage)),
    { message: 'Progression starts at stage one and stages must not decrease' })
    .refine(value => value.fireRateMultipliers.every((rate, index) => index === 0
      || rate >= value.fireRateMultipliers[index - 1]), { message: 'Rifle rate stages must not decrease' })
    .default({ xpRequirements: [28, 60, 110, 180],
      levelPlan: [{ fireRateStage: 1, squadStage: 1 }, { fireRateStage: 2, squadStage: 1 },
        { fireRateStage: 3, squadStage: 1 }, { fireRateStage: 3, squadStage: 2 }, { fireRateStage: 3, squadStage: 3 }],
      fireRateMultipliers: [1, 1.25, 1.5], gruntKillXp: 1, heavyKillXp: 10,
      reinforcementLevel: 7, reinforcementArrivalSeconds: 1.1, reinforcementSpacing: .72, reinforcementStagger: .18 }),
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
    unlockLevel: z.number().int().min(6).default(6),
    introDelaySeconds: z.number().finite().nonnegative().default(4),
    hp: z.number().finite().positive().default(210),
    xp: z.number().int().nonnegative().default(120),
    speed: z.number().finite().nonnegative().default(.08),
    // Render projection only: the compressed Heavy makes 1.9 the 2.18× crown target.
    visualScale: z.number().finite().min(1.8).max(5).default(1.9),
    widthMultiplier: z.number().finite().positive().default(.94),
    gaitCycleMs: z.number().finite().positive().default(850),
  }).default({ enabled: false, unlockLevel: 6, introDelaySeconds: 4, hp: 210, xp: 120,
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
}).refine((value) => value.defenseMode || (value.groupSize - 1) * value.groupRowStride < value.waveRows,
  { message: 'Group must fit inside one wave' })
  .refine(value => value.landingAssault.groupSize <= value.landingAssault.activeSoftCap,
    { message: 'Landing group must fit inside the active soft cap' })
  .refine(value => value.pressureLaneCount === undefined || value.pressureLaneCount <= value.laneCount,
    { message: 'Pressure lane count must fit inside the battlefield' });

export type CatharsisConfig = z.infer<typeof CatharsisConfigSchema>;
