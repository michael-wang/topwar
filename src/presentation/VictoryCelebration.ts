import type {SimulationFrameState, ProjectileSimulationState} from '../simulation/SimulationState';
import {attackLanePositions} from '../simulation/enemies/laneComposition';
import {createDefenseSquadFormation,defenseSquadInwardShift} from '../simulation/squad/formation';
import {effectivePrimaryFireRate, progressionStage} from '../simulation/progression';

type VisualShot = Omit<ProjectileSimulationState, 'damage' | 'blastRadius' | 'penetrationRemaining' | 'lane'>;
/** Ephemeral post-clear controls and tracers. Never written back to Simulation or checkpoints. */
export class VictoryCelebration {
  readonly player: {x: number; z: number; selectedLane: number};
  readonly projectiles: VisualShot[] = [];
  private readonly free: VisualShot[] = [];
  private readonly lanes: number[];
  private readonly offsets: {x: number; z: number}[];
  private readonly formation: NonNullable<SimulationFrameState['catharsis']>['balance']['progression'];
  private readonly cooldowns: number[];
  private readonly interval: number;
  private readonly speed: number;
  private readonly range: number;
  private readonly kind: 'rifle' | 'machineGun';
  private readonly switchSeconds: number;
  private nextId: number;
  private previousMs: number;
  private movement = true;
  private ceaseFire = false;
  get firingEnabled(): boolean { return !this.ceaseFire; }

  constructor(state: SimulationFrameState, nowMs: number,
    tuning: {formationSpacing: number; fireRate: number; bulletSpeed: number; bulletRange: number},
    existing: SimulationFrameState['projectiles'] = state.projectiles) {
    const c = state.catharsis!;
    this.player = {x: state.player.x, z: 0, selectedLane: state.player.selectedLane!};
    this.lanes = attackLanePositions(c.balance.laneCount, c.trackHalfWidth, c.balance.edgeInset);
    this.switchSeconds = c.balance.laneSwitchSeconds;
    this.offsets = createDefenseSquadFormation(state.squad.count, tuning.formationSpacing, c.balance.progression);
    this.formation = c.balance.progression;
    this.kind = progressionStage(state.progression!.level, c.balance.progression).weaponFamily;
    this.interval = 1 / effectivePrimaryFireRate(tuning.fireRate, state.progression!.level, c.balance);
    this.speed = this.kind === 'machineGun' ? c.balance.machineGun.projectileSpeed : tuning.bulletSpeed;
    this.range = this.kind === 'machineGun' ? c.balance.machineGun.range : tuning.bulletRange;
    this.cooldowns = this.offsets.map((_, i) => state.weapons.rifleMemberCooldowns?.[i]
      ?? state.weapons.rifleCooldownRemainingSeconds + i * this.interval / this.offsets.length);
    this.nextId = state.weapons.nextProjectileId; this.previousMs = nowMs;
    for (const shot of existing) this.projectiles.push({id: shot.id, kind: shot.kind, tier: shot.tier,
      x: shot.x, z: shot.z - state.player.z, speed: shot.speed, remainingRange: shot.remainingRange,
      slopeX: shot.slopeX, memberIndex: shot.memberIndex, hitRadiusBonus: shot.hitRadiusBonus});
    // Flight duration and cadence bound live shots. Reuse this pool for the short finale.
    const capacity = Math.ceil(this.range / this.speed / this.interval + 1) * this.offsets.length;
    for (let i = 0; i < capacity; i++) this.free.push({id: 0, kind: this.kind, tier: 1,
      x: 0, z: 0, speed: this.speed, remainingRange: 0, hitRadiusBonus: 0, slopeX: 0, memberIndex: 0});
  }

  stepLane(direction: -1 | 1): boolean {
    if (!this.movement) return false;
    const lane = Math.max(0, Math.min(this.lanes.length - 1, this.player.selectedLane + direction));
    if (lane === this.player.selectedLane) return false;
    this.player.selectedLane = lane;
    return lane + direction >= 0 && lane + direction < this.lanes.length;
  }

  update(nowMs: number, paused: boolean, commendationStarted: boolean, resultsVisible: boolean): void {
    // Both boundaries latch; Skip and a vanished communication panel cannot rearm fire.
    this.ceaseFire ||= commendationStarted || resultsVisible;
    this.movement &&= !resultsVisible;
    const dt = paused ? 0 : Math.max(0, nowMs - this.previousMs) / 1000;
    this.previousMs = nowMs;
    if (dt === 0) return;
    if (this.movement) {
      const target = this.lanes[this.player.selectedLane], delta = target - this.player.x;
      const travel = (this.lanes[1] - this.lanes[0]) / this.switchSeconds * dt;
      this.player.x += Math.sign(delta) * Math.min(Math.abs(delta), travel);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i], travel = Math.min(shot.speed * dt, shot.remainingRange);
      shot.z += travel; shot.x += (shot.slopeX ?? 0) * travel; shot.remainingRange -= travel;
      if (shot.remainingRange <= 1e-8) { this.projectiles.splice(i, 1); this.free.push(shot); }
    }
    if (this.ceaseFire) return;
    const shift = defenseSquadInwardShift(this.offsets.length, this.formation, this.player.x, this.lanes.at(-1));
    for (let i = 0; i < this.cooldowns.length; i++) {
      let cooldown = this.cooldowns[i] - dt;
      while (cooldown <= 0) {
        const shot = this.free.pop();
        if (shot) {
          const travel = Math.min(this.speed * -cooldown, this.range);
          Object.assign(shot, {id: this.nextId++, kind: this.kind, tier: 1, memberIndex: i, slopeX: 0,
            x: this.player.x + this.offsets[i].x + shift, z: this.offsets[i].z + travel,
            speed: this.speed, remainingRange: this.range - travel, hitRadiusBonus: 0});
          this.projectiles.push(shot);
        }
        cooldown += this.interval;
      }
      this.cooldowns[i] = cooldown;
    }
  }
}
