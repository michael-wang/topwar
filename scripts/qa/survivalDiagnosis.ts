import type { EnemySimulationState, SimulationState } from '../../src/simulation/SimulationState';
import { enemyApproachSpeed } from '../../src/simulation/enemies/latePressure';
import { effectivePrimaryFireRate, progressionStage, type ProgressionState } from '../../src/simulation/progression';
import type { DiagnosticObserver } from './survivalDiagnosisHooks';
import { pilotTuning } from './DefensePilot';

const boundaries = [30, 20, 10] as const;
export type Loadout = { at: number; level: number; xp: number; weapon: string; stage: number; soldiers: number; hz: number };
export type EnemyRecord = {
  id: number; cohort: number; archetype: string; lane: number; x: number; z: number; hp: number; speed: number;
  closest: number; crossed: Record<string, { at: number; hp: number }>;
  theoretical: Record<string, number>; death?: { at: number; cause: string; nominalXp: number; usableXp: number; distance: number };
  damage: Record<string, number>; successfulHits: Record<string, number>;
};
export type Cohort = {
  id: number; kind: string; at: number; spawn: Loadout; row?: number; cursor?: number; ids: number[];
};
function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))];
}
export class SurvivalDiagnosis implements DiagnosticObserver {
  readonly cohorts: Cohort[] = [];
  readonly enemies = new Map<number, EnemyRecord>();
  readonly timeline: Loadout[] = [];
  readonly samples: Record<string, unknown>[] = [];
  readonly casualties: Record<string, unknown>[] = [];
  readonly opportunities: Record<string, unknown>[] = [];
  readonly admissions: Record<string, unknown>[] = [];
  private now = 0;
  private kind = 'initial';
  private playerZ = 0;
  private loadout!: Loadout;
  private balance: NonNullable<SimulationState['catharsis']>['balance'];
  private sums = { active: 0, near30: 0, near20: 0, near10: 0, hp: 0, globalTarget: 0, laneTarget: 0 };
  private peaks = { active: 0, near30: 0, near20: 0, near10: 0, projectiles: 0 };
  private laneHpSum = [0, 0, 0, 0, 0];
  private laneHpPeak = [0, 0, 0, 0, 0];
  private laneNearPeak = [0, 0, 0, 0, 0];
  private ticks = 0;
  private fired = 0;
  private noTarget = 0;
  private longestNoTarget = 0;
  private noLaneTarget = 0;
  private longestNoLaneTarget = 0;
  private pendingXp = new Map<number, { nominal: number; usable: number }>();
  private survivalActive: number | null = null;
  constructor(initial: SimulationState) {
    this.balance = initial.catharsis!.balance;
    this.survivalActive = initial.postCapSurvival?.startedAtSeconds ?? null;
    this.begin(initial, 0);
    this.kind = this.survivalActive === null ? 'initial' : 'survival-initial';
    this.admitted(initial.enemies, { cursor: initial.enemyStream?.nextRowIndex });
    this.timeline.push({ ...this.loadout });
  }
  begin(state: SimulationState, dt = 1 / 60): void {
    this.now = state.elapsedSeconds + dt;
    this.frame(state.progression, state.squad, state.player.z);
  }
  frame(progression: ProgressionState | undefined, squad: SimulationState['squad'], playerZ: number): void {
    this.playerZ = playerZ;
    const p = progression!, stage = progressionStage(p.level, this.balance.progression);
    this.loadout = { at: this.now, level: p.level, xp: p.xp, weapon: stage.weaponFamily, stage: stage.fireRateStage,
      soldiers: squad.count, hz: effectivePrimaryFireRate(pilotTuning.rifle.fireRate, p.level, this.balance) * squad.count };
  }
  phase(name: string): void { this.kind = name; }
  admitted(enemies: EnemySimulationState[], metadata: { row?: number; cursor?: number }): void {
    if (!enemies.length) return;
    const cohort: Cohort = { id: this.cohorts.length, kind: this.kind, at: this.now,
      spawn: { ...this.loadout }, ...metadata, ids: enemies.map(e => e.id) };
    this.cohorts.push(cohort);
    for (const enemy of enemies) {
      if (this.enemies.has(enemy.id)) throw new Error(`Duplicate admitted ID ${enemy.id}`);
      const speed = enemyApproachSpeed(enemy, this.balance), distance = enemy.z - this.playerZ;
      this.enemies.set(enemy.id, { id: enemy.id, cohort: cohort.id, archetype: enemy.archetype!, lane: enemy.lane!,
        x: enemy.x, z: enemy.z, hp: enemy.hp, speed, closest: distance, crossed: {}, damage: {}, successfulHits: {},
        theoretical: Object.fromEntries(boundaries.map(b => [b, this.now + Math.max(0, distance - b) / speed])) });
      this.position(enemy);
    }
  }
  private position(enemy: EnemySimulationState): void {
    const record = this.enemies.get(enemy.id);
    if (!record) throw new Error(`Unobserved admission ${enemy.id}`);
    const distance = enemy.z - this.playerZ;
    record.closest = Math.min(record.closest, distance);
    for (const b of boundaries) if (distance <= b + 1e-9 && !record.crossed[b])
      record.crossed[b] = { at: this.now, hp: Math.max(0, enemy.hp) };
  }
  positions(enemies: EnemySimulationState[]): void { for (const enemy of enemies) this.position(enemy); }
  hit(enemy: EnemySimulationState, damage: number, cause: string): void {
    this.position(enemy);
    const r = this.enemies.get(enemy.id)!;
    r.damage[cause] = (r.damage[cause] ?? 0) + Math.min(enemy.hp, damage);
    r.successfulHits[cause] = (r.successfulHits[cause] ?? 0) + 1;
  }
  reward(enemy: EnemySimulationState, amount: number, before: ProgressionState, after: ProgressionState): void {
    const earned = (p: ProgressionState) => this.balance.progression.xpRequirements.slice(0, p.level - 1)
      .reduce((sum, xp) => sum + xp, 0) + p.xp;
    this.pendingXp.set(enemy.id, { nominal: amount, usable: earned(after) - earned(before) });
  }
  removed(enemy: EnemySimulationState, cause: string): void {
    this.position(enemy);
    const r = this.enemies.get(enemy.id)!;
    if (r.death) throw new Error(`Duplicate removal ${enemy.id}`);
    const xp = this.pendingXp.get(enemy.id);
    if (['contact', 'leak'].includes(cause) && xp) throw new Error('Contact incorrectly credited XP');
    if (!['contact', 'leak'].includes(cause) && !xp) throw new Error('Missing kill reward hook');
    r.death = { at: this.now, cause, nominalXp: xp?.nominal ?? 0, usableXp: xp?.usable ?? 0, distance: enemy.z - this.playerZ };
    this.pendingXp.delete(enemy.id);
  }
  end(state: SimulationState, before: SimulationState, presentation: { kind: string; [key: string]: unknown }[]): void {
    this.frame(state.progression, state.squad, state.player.z);
    this.positions(state.enemies);
    const last = this.timeline.at(-1)!;
    if (last.level !== this.loadout.level || last.soldiers !== this.loadout.soldiers || last.hz !== this.loadout.hz)
      this.timeline.push({ ...this.loadout });
    this.survivalActive = state.postCapSurvival?.startedAtSeconds ?? null;
    for (const key of ['nextGiantAtSeconds', 'nextGrenadeSupplyAtSeconds'] as const) {
      const prev = before.postCapSurvival?.[key];
      if (prev != null && state.postCapSurvival?.[key] !== prev) this.opportunities.push({ at: this.now, due: prev,
        kind: key, admitted: key === 'nextGiantAtSeconds' ? this.cohorts.some(c => c.at === this.now && c.kind === 'survival-opportunity')
          : before.grenade?.supply === null && state.grenade?.supply !== null });
    }
    if (before.defenseWaves?.nextAtSeconds !== state.defenseWaves?.nextAtSeconds
      && this.now + 1e-9 >= (before.defenseWaves?.nextAtSeconds ?? Infinity)) {
      const waves = this.cohorts.filter(c => c.at === this.now && c.kind === 'survival-wave');
      if (before.postCapSurvival?.startedAtSeconds != null)
        this.admissions.push({ at: this.now, due: before.defenseWaves!.nextAtSeconds, cohorts: waves.map(c => c.id), admitted: waves.length > 0 });
    }
    for (const event of presentation) if (event.kind === 'normalEnemyContact' || event.kind === 'artilleryContact')
      this.casualties.push({ at: this.now, ...event });
    if (this.survivalActive === null) return;
    this.ticks++;
    this.fired += state.weapons.nextProjectileId - before.weapons.nextProjectileId;
    const live = state.enemies, near = boundaries.map(b => live.filter(e => e.z - state.player.z <= b));
    const hp = live.reduce((sum, e) => sum + e.hp, 0);
    const range = this.loadout.weapon === 'machineGun' ? this.balance.machineGun.range : pilotTuning.rifle.range;
    const inRange = live.filter(e => e.z > state.player.z && e.z - state.player.z <= range);
    const laneTarget = inRange.some(e => e.lane === state.player.selectedLane);
    const hasTarget = inRange.length > 0;
    this.noTarget = hasTarget ? 0 : this.noTarget + 1 / 60;
    this.longestNoTarget = Math.max(this.longestNoTarget, this.noTarget);
    this.noLaneTarget = laneTarget ? 0 : this.noLaneTarget + 1 / 60;
    this.longestNoLaneTarget = Math.max(this.longestNoLaneTarget, this.noLaneTarget);
    this.sums.active += live.length; this.sums.hp += hp;
    this.sums.near30 += near[0].length; this.sums.near20 += near[1].length; this.sums.near10 += near[2].length;
    this.sums.globalTarget += Number(hasTarget); this.sums.laneTarget += Number(laneTarget);
    this.peaks.active = Math.max(this.peaks.active, live.length); this.peaks.projectiles = Math.max(this.peaks.projectiles, state.projectiles.length);
    for (let i = 0; i < 3; i++) this.peaks[`near${boundaries[i]}`] = Math.max(this.peaks[`near${boundaries[i]}`], near[i].length);
    const laneHp = Array.from({ length: 5 }, (_, lane) => live.filter(e => e.lane === lane).reduce((sum, e) => sum + e.hp, 0));
    for (let lane = 0; lane < 5; lane++) {
      this.laneHpSum[lane] += laneHp[lane]; this.laneHpPeak[lane] = Math.max(this.laneHpPeak[lane], laneHp[lane]);
      this.laneNearPeak[lane] = Math.max(this.laneNearPeak[lane], near[2].filter(e => e.lane === lane).length);
    }
    if (state.tick % 60 === 0) this.samples.push({ age: this.now - this.survivalActive, ...this.loadout,
      active: live.length, near: near.map(a => a.length), hp, laneHp, projectiles: state.projectiles.length, hasTarget, laneTarget });
  }
  finish(state: SimulationState) {
    if (this.pendingXp.size) throw new Error('Unpaired XP events');
    const end = state.elapsedSeconds, activation = state.postCapSurvival?.startedAtSeconds ?? null;
    // The timeline stores loadout changes, not a continuously sampled XP counter.
    const loadoutAt = (time: number) => {
      if (time > end + 1e-9) return null;
      const found = [...this.timeline].reverse().find(s => s.at <= time + 1e-9)!;
      const { xp, ...loadout } = found;
      return loadout;
    };
    const records = [...this.enemies.values()];
    const cohorts = this.cohorts.map(c => {
      const members = c.ids.map(id => {
        const e = this.enemies.get(id)!;
        return { ...e, theoreticalLoadouts: Object.fromEntries([20, 10].map(b => [b, loadoutAt(e.theoretical[b])])) };
      });
      const deaths = members.filter(e => e.death);
      const kills = deaths.filter(e => !['contact', 'leak'].includes(e.death!.cause));
      const nextLevel = this.timeline.find(s => s.at >= c.at && s.level > c.spawn.level);
      const arrivals = Object.fromEntries([20, 10].map(b => {
        const times = members.map(e => e.theoretical[b]);
        const at = Math.min(...times), lastAt = Math.max(...times), observed = loadoutAt(at);
        return [b, { firstAt: at, lastAt, firstLoadout: observed, lastLoadout: loadoutAt(lastAt),
          censored: observed === null, speedFactors: { '1.0': at - c.at, '1.4': (at - c.at) / 1.4, '1.6': (at - c.at) / 1.6 } }];
      }));
      return { ...c, members, counts: Object.fromEntries(['grunt', 'heavy', 'giant'].map(a => [a, members.filter(e => e.archetype === a).length])),
        initialHp: members.reduce((sum, e) => sum + e.hp, 0), mgHits: members.reduce((sum, e) => sum + Math.ceil(e.hp / this.balance.machineGun.damageEnemyHp), 0),
        deaths: Object.fromEntries(['projectile', 'grenade', 'rocket', 'contact', 'leak'].map(a => [a, deaths.filter(e => e.death!.cause === a).length])),
        nominalXp: kills.reduce((sum, e) => sum + e.death!.nominalXp, 0), usableXp: kills.reduce((sum, e) => sum + e.death!.usableXp, 0),
        clearedAt: deaths.length === members.length ? Math.max(...deaths.map(e => e.death!.at)) : null,
        combatCleared: kills.length === members.length, closest: Math.min(...members.map(e => e.closest)),
        crossings: Object.fromEntries(boundaries.map(b => [b, { count: members.filter(e => e.crossed[b]).length,
          hp: members.reduce((sum, e) => sum + (e.crossed[b]?.hp ?? 0), 0) }])), arrivals,
        nextLevel: nextLevel ?? null,
        eliminatedBeforeNextLevel: nextLevel ? kills.filter(e => e.death!.at <= nextLevel.at).length / members.length : null,
        remainingAfterNextLevel: nextLevel ? members.filter(e => !e.death || e.death.at > nextLevel.at).length : null,
        lifetimeLoadouts: this.timeline.filter(s => s.at >= c.at && s.at <= (deaths.length === members.length ? Math.max(...deaths.map(e => e.death!.at)) : end)),
      };
    });
    const survival = cohorts.filter(c => c.kind === 'survival-wave' || c.kind === 'survival-initial');
    const mature = survival.filter(c => c.combatCleared || c.members.every(e => e.death || e.theoretical[10] <= end));
    const admitted = survival.flatMap(c => c.members), removals = records.filter(e => e.death && activation !== null && e.death.at >= activation);
    const kills = removals.filter(e => !['contact', 'leak'].includes(e.death!.cause));
    const duration = activation === null ? 0 : end - activation;
    const mean = Object.fromEntries(Object.entries(this.sums).map(([k, v]) => [k, this.ticks ? v / this.ticks : null]));
    return { activation, end, survivalSeconds: duration, gameOver: state.squad.count === 0, endLevel: state.progression!.level,
      endSquad: state.squad.count, timeline: this.timeline, mean, peaks: this.peaks,
      laneHpMean: this.laneHpSum.map(v => this.ticks ? v / this.ticks : null), laneHpPeak: this.laneHpPeak, laneNear10Peak: this.laneNearPeak,
      longestNoTarget: this.longestNoTarget, longestNoLaneTarget: this.longestNoLaneTarget,
      spawnPerSecond: duration ? records.filter(e => cohorts[e.cohort].at >= activation!).length / duration : null,
      killsPerSecond: duration ? kills.length / duration : null,
      emittedShots: this.fired, emittedShotsPerSecond: duration ? this.fired / duration : null,
      nominalXp: records.reduce((sum, e) => sum + (e.death?.nominalXp ?? 0), 0),
      usableXp: records.reduce((sum, e) => sum + (e.death?.usableXp ?? 0), 0),
      giantXp: records.filter(e => e.archetype === 'giant').reduce((sum, e) => sum + (e.death?.nominalXp ?? 0), 0),
      survivalNominalXp: kills.reduce((sum, e) => sum + e.death!.nominalXp, 0),
      survivalUsableXp: kills.reduce((sum, e) => sum + e.death!.usableXp, 0),
      survivalGiants: cohorts.filter(c => c.kind === 'survival-opportunity'),
      ordinaryWaves: survival.length, observedMatureWaves: mature.length,
      longRangeClearFraction: mature.length ? mature.filter(c => c.combatCleared && c.closest > 20).length / mature.length : null,
      crossedFraction: Object.fromEntries(boundaries.map(b => [b, admitted.length ? admitted.filter(e => e.crossed[b]).length / admitted.length : null])),
      waveClearMedian: percentile(survival.filter(c => c.combatCleared).map(c => c.clearedAt! - c.at), .5),
      cohorts, admissions: this.admissions, opportunities: this.opportunities, casualties: this.casualties, samples: this.samples,
    };
  }
}
