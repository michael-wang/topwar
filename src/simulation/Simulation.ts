import { SeededRng } from '../core/Rng';
import { LevelDefinitionSchema, type LevelDefinition } from '../level/LevelDefinition';
import { createEnemyFormation } from './enemies/formation';
import { afterCasualties } from './squad/composition';
import { createSquadFormation } from './squad/formation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState, UpgradeGateSimulationState } from './SimulationState';

export interface SimulationOptions {
  seed: number;
  level: LevelDefinition;
  startSquad: number;
  startRocketCount: number;
  gruntHp: number;
}

export interface SimulationInput {
  targetX: number;
}

export interface SimulationTuning {
  moveSpeed: number;
  forwardSpeed: number;
  trackHalfWidth: number;
  defenseLineOffset: number;
  formationSpacing: number;
  memberRadius: number;
  gruntRadius: number;
  gruntContactDamage: number;
  rifle: { damage: number; fireRate: number; projectileSpeed: number; range: number };
  rocket: { damage: number; fireRate: number; projectileSpeed: number; range: number; blastRadius: number };
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

type ProjectileHit = { kind: 'enemy'; enemy: EnemySimulationState; z: number }
  | { kind: 'gate'; gate: UpgradeGateSimulationState; z: number };

function findFirstHit(projectile: ProjectileSimulationState, endZ: number,
  enemies: EnemySimulationState[], gates: UpgradeGateSimulationState[], radius: number): ProjectileHit | undefined {
  let first: ProjectileHit | undefined;
  for (const enemy of enemies) {
    const dx = projectile.x - enemy.x;
    if (Math.abs(dx) > radius) continue;
    const halfChord = Math.sqrt(radius * radius - dx * dx);
    const entryZ = enemy.z - halfChord;
    const exitZ = enemy.z + halfChord;
    if (exitZ < projectile.z || entryZ > endZ) continue;
    const hitZ = Math.max(projectile.z, entryZ);
    if (!first || hitZ < first.z || (hitZ === first.z && first.kind === 'enemy' && enemy.id < first.enemy.id)) {
      first = { kind: 'enemy', enemy, z: hitZ };
    }
  }
  for (const gate of gates) {
    if (gate.z < projectile.z || gate.z > endZ || Math.abs(projectile.x - gate.x) > gate.width / 2) continue;
    // A gate wins an exact-distance tie so it cannot be shot through.
    if (!first || gate.z < first.z || (gate.z === first.z && (first.kind === 'enemy' || gate.id < first.gate.id))) {
      first = { kind: 'gate', gate, z: gate.z };
    }
  }
  return first;
}

function segmentTouchesCircle(startX: number, startZ: number, endX: number, endZ: number,
  centerX: number, centerZ: number, radius: number): boolean {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((centerX - startX) * deltaX + (centerZ - startZ) * deltaZ) / lengthSquared));
  const distanceX = centerX - (startX + fraction * deltaX);
  const distanceZ = centerZ - (startZ + fraction * deltaZ);
  return distanceX * distanceX + distanceZ * distanceZ <= radius * radius;
}

function validLevelId(levelId: unknown): levelId is string {
  return typeof levelId === 'string' && levelId.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validSquadCount(count: unknown): count is number {
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
}

function validateState(value: unknown): { state: SimulationState; rng: SeededRng } {
  if (!isPlainObject(value)) {
    throw new Error('Simulation state must be a plain object');
  }
  const state = value;
  const fields = ['tick', 'elapsedSeconds', 'levelId', 'seed', 'rngState', 'player', 'squad', 'enemies', 'gates', 'projectiles', 'weapons'];
  if (Object.keys(state).length !== fields.length || fields.some((field) => !Object.hasOwn(state, field))) {
    throw new Error('Simulation state has missing or unknown fields');
  }
  if (!Number.isSafeInteger(state.tick) || (state.tick as number) < 0) {
    throw new Error('Simulation tick must be a non-negative integer');
  }
  if (typeof state.elapsedSeconds !== 'number' || !Number.isFinite(state.elapsedSeconds) || state.elapsedSeconds < 0) {
    throw new Error('Simulation elapsedSeconds must be finite and non-negative');
  }
  if (!validLevelId(state.levelId)) throw new Error('Simulation levelId must be a non-empty string');

  const rng = new SeededRng(state.seed as number);
  rng.setState(state.rngState as number);

  if (!isPlainObject(state.player)) {
    throw new Error('Simulation player must be a plain object');
  }
  const player = state.player;
  if (Object.keys(player).length !== 2 || !Object.hasOwn(player, 'x') || !Object.hasOwn(player, 'z')) {
    throw new Error('Simulation player has missing or unknown fields');
  }
  if (typeof player.x !== 'number' || !Number.isFinite(player.x)) {
    throw new Error('Simulation player.x must be finite');
  }
  if (typeof player.z !== 'number' || !Number.isFinite(player.z)) {
    throw new Error('Simulation player.z must be finite');
  }

  if (!isPlainObject(state.squad)) {
    throw new Error('Simulation squad must be a plain object');
  }
  const squad = state.squad;
  if (Object.keys(squad).length !== 2 || !Object.hasOwn(squad, 'count') || !Object.hasOwn(squad, 'rocketCount')) {
    throw new Error('Simulation squad must contain only count and rocketCount');
  }
  if (!validSquadCount(squad.count) || !validSquadCount(squad.rocketCount)
    || (squad.rocketCount as number) > (squad.count as number)) {
    throw new Error('Simulation squad count and rocketCount must be valid, with rocketCount <= count');
  }

  if (!Array.isArray(state.enemies)) throw new Error('Simulation enemies must be an array');
  const enemyIds = new Set<number>();
  const enemies: EnemySimulationState[] = state.enemies.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation enemy ${index} must be a plain object`);
    if (Object.keys(value).length !== 5 || ['id', 'type', 'x', 'z', 'hp'].some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation enemy ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0) {
      throw new Error(`Simulation enemy ${index} id must be a positive safe integer`);
    }
    const id = value.id as number;
    if (enemyIds.has(id)) throw new Error(`Simulation enemy id ${id} is duplicated`);
    enemyIds.add(id);
    if (value.type !== 'grunt') throw new Error(`Simulation enemy ${index} type is unsupported`);
    if (typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation enemy ${index} position must be finite`);
    }
    if (!positiveFinite(value.hp)) throw new Error(`Simulation enemy ${index} hp must be positive and finite`);
    return { id, type: 'grunt', x: value.x, z: value.z, hp: value.hp };
  });

  if (!Array.isArray(state.gates)) throw new Error('Simulation gates must be an array');
  const gateIds = new Set<string>();
  const gates: UpgradeGateSimulationState[] = state.gates.map((value: unknown, index: number) => {
    if (!isPlainObject(value) || Object.keys(value).length !== 8
      || ['id', 'choiceGroup', 'x', 'z', 'width', 'hp', 'maxHp', 'reward'].some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation gate ${index} has missing or unknown fields`);
    }
    if (!validLevelId(value.id) || gateIds.has(value.id)) throw new Error(`Simulation gate ${index} id is invalid or duplicated`);
    gateIds.add(value.id);
    if (!validLevelId(value.choiceGroup) || typeof value.x !== 'number' || !Number.isFinite(value.x)
      || typeof value.z !== 'number' || !Number.isFinite(value.z) || value.z < 0
      || !positiveFinite(value.width) || !positiveFinite(value.hp) || !positiveFinite(value.maxHp)
      || value.hp > value.maxHp) {
      throw new Error(`Simulation gate ${index} has invalid position, width, or HP`);
    }
    const reward = value.reward;
    if (!isPlainObject(reward) || Object.keys(reward).length !== 2
      || !Object.hasOwn(reward, 'kind') || !Object.hasOwn(reward, 'amount')
      || (reward.kind !== 'rifle' && reward.kind !== 'rocket')
      || !Number.isSafeInteger(reward.amount) || (reward.amount as number) <= 0) {
      throw new Error(`Simulation gate ${index} reward is invalid`);
    }
    return { id: value.id, choiceGroup: value.choiceGroup, x: value.x, z: value.z, width: value.width,
      hp: value.hp, maxHp: value.maxHp, reward: { kind: reward.kind, amount: reward.amount as number } };
  });

  if (!Array.isArray(state.projectiles)) throw new Error('Simulation projectiles must be an array');
  const projectileIds = new Set<number>();
  const projectiles: ProjectileSimulationState[] = state.projectiles.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation projectile ${index} must be a plain object`);
    if (Object.keys(value).length !== 8 || ['id', 'kind', 'x', 'z', 'speed', 'damage', 'remainingRange', 'blastRadius']
      .some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation projectile ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || projectileIds.has(value.id as number)) {
      throw new Error(`Simulation projectile ${index} id must be unique and positive`);
    }
    projectileIds.add(value.id as number);
    if (value.kind !== 'rifle' && value.kind !== 'rocket') {
      throw new Error(`Simulation projectile ${index} kind is unsupported`);
    }
    if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation projectile ${index} position must be finite`);
    }
    if (!positiveFinite(value.speed) || !positiveFinite(value.damage) || !positiveFinite(value.remainingRange)) {
      throw new Error(`Simulation projectile ${index} speed, damage, and remainingRange must be positive and finite`);
    }
    if (typeof value.blastRadius !== 'number' || !Number.isFinite(value.blastRadius)
      || (value.kind === 'rifle' && value.blastRadius !== 0)
      || (value.kind === 'rocket' && value.blastRadius <= 0)) {
      throw new Error(`Simulation projectile ${index} blastRadius is invalid for its kind`);
    }
    return { id: value.id as number, kind: value.kind, x: value.x, z: value.z, speed: value.speed,
      damage: value.damage, remainingRange: value.remainingRange, blastRadius: value.blastRadius };
  });
  const weapons = state.weapons;
  if (!isPlainObject(weapons) || Object.keys(weapons).length !== 3
    || ['rifleCooldownRemainingSeconds', 'rocketCooldownRemainingSeconds', 'nextProjectileId']
      .some((field) => !Object.hasOwn(weapons, field))) {
    throw new Error('Simulation weapons state has missing or unknown fields');
  }
  for (const key of ['rifleCooldownRemainingSeconds', 'rocketCooldownRemainingSeconds'] as const) {
    const cooldown = weapons[key];
    if (typeof cooldown !== 'number' || !Number.isFinite(cooldown) || cooldown < 0) {
      throw new Error(`Simulation ${key} must be finite and non-negative`);
    }
  }
  const nextProjectileId = weapons.nextProjectileId;
  if (!Number.isSafeInteger(nextProjectileId) || (nextProjectileId as number) <= 0
    || projectiles.some((projectile) => projectile.id >= (nextProjectileId as number))) {
    throw new Error('Simulation weapons nextProjectileId must exceed active projectile IDs');
  }

  return {
    state: {
      tick: state.tick as number,
      elapsedSeconds: state.elapsedSeconds,
      levelId: state.levelId,
      seed: state.seed as number,
      rngState: rng.getState(),
      player: { x: player.x, z: player.z },
      squad: { count: squad.count, rocketCount: squad.rocketCount },
      enemies,
      gates,
      projectiles,
      weapons: { rifleCooldownRemainingSeconds: weapons.rifleCooldownRemainingSeconds as number,
        rocketCooldownRemainingSeconds: weapons.rocketCooldownRemainingSeconds as number,
        nextProjectileId: nextProjectileId as number },
    },
    rng,
  };
}

export class Simulation {
  private rng: SeededRng;
  private state: SimulationState;

  constructor(options: SimulationOptions) {
    this.rng = new SeededRng(options.seed);
    const level = LevelDefinitionSchema.parse(options.level);
    if (!validSquadCount(options.startSquad)) {
      throw new Error('Simulation startSquad must be a non-negative safe integer');
    }
    if (!validSquadCount(options.startRocketCount) || options.startRocketCount > options.startSquad) {
      throw new Error('Simulation startRocketCount must be a non-negative safe integer within startSquad');
    }
    if (!positiveFinite(options.gruntHp)) throw new Error('Simulation gruntHp must be positive and finite');
    const enemies: EnemySimulationState[] = [];
    for (const group of level.enemyGroups) {
      for (const offset of createEnemyFormation(group.count, group.formation.columns,
        group.formation.spacing, group.formation.jitter, group.formation.seed)) {
        const z = group.z + offset.z;
        if (!Number.isFinite(offset.x) || !Number.isFinite(z)) {
          throw new Error(`Enemy group ${group.id} produces a non-finite position`);
        }
        enemies.push({
          id: enemies.length + 1,
          type: group.enemy,
          x: offset.x,
          z,
          hp: options.gruntHp,
        });
      }
    }
    this.state = {
      tick: 0,
      elapsedSeconds: 0,
      levelId: level.id,
      seed: options.seed,
      rngState: this.rng.getState(),
      player: { x: 0, z: 0 },
      squad: { count: options.startSquad, rocketCount: options.startRocketCount },
      enemies,
      gates: level.upgradeGates.map((gate) => ({ ...gate, maxHp: gate.hp, reward: { ...gate.reward } })),
      projectiles: [],
      weapons: { rifleCooldownRemainingSeconds: 0, rocketCooldownRemainingSeconds: 0, nextProjectileId: 1 },
    };
  }

  step(dtSeconds: number, input: SimulationInput, tuning: SimulationTuning): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      throw new Error('Simulation dtSeconds must be finite and greater than zero');
    }
    if (!input || !Number.isFinite(input.targetX)) {
      throw new Error('Simulation targetX must be finite');
    }
    if (!tuning || !Number.isFinite(tuning.moveSpeed) || tuning.moveSpeed < 0) {
      throw new Error('Simulation moveSpeed must be finite and non-negative');
    }
    if (!Number.isFinite(tuning.forwardSpeed) || tuning.forwardSpeed < 0) {
      throw new Error('Simulation forwardSpeed must be finite and non-negative');
    }
    if (!Number.isFinite(tuning.trackHalfWidth) || tuning.trackHalfWidth <= 0) {
      throw new Error('Simulation trackHalfWidth must be finite and greater than zero');
    }
    if (!positiveFinite(tuning.defenseLineOffset)) {
      throw new Error('Simulation defenseLineOffset must be finite and greater than zero');
    }
    if (!positiveFinite(tuning.formationSpacing) || !positiveFinite(tuning.memberRadius)
      || !positiveFinite(tuning.gruntRadius)) {
      throw new Error('Simulation formationSpacing, memberRadius, and gruntRadius must be positive and finite');
    }
    if (!Number.isSafeInteger(tuning.gruntContactDamage) || tuning.gruntContactDamage <= 0) {
      throw new Error('Simulation gruntContactDamage must be a positive safe integer');
    }
    if (!tuning.rifle || !positiveFinite(tuning.rifle.damage) || !positiveFinite(tuning.rifle.fireRate)
      || !positiveFinite(tuning.rifle.projectileSpeed) || !positiveFinite(tuning.rifle.range)) {
      throw new Error('Simulation rifle tuning must be positive and finite');
    }
    if (!tuning.rocket || !positiveFinite(tuning.rocket.damage) || !positiveFinite(tuning.rocket.fireRate)
      || !positiveFinite(tuning.rocket.projectileSpeed) || !positiveFinite(tuning.rocket.range)
      || !positiveFinite(tuning.rocket.blastRadius)) {
      throw new Error('Simulation rocket tuning must be positive and finite');
    }
    const nextElapsedSeconds = this.state.elapsedSeconds + dtSeconds;
    if (!Number.isFinite(nextElapsedSeconds) || !Number.isSafeInteger(this.state.tick + 1)) {
      throw new Error('Simulation time or tick exceeds the supported range');
    }
    if (this.state.squad.count === 0) {
      this.state = { ...this.state, tick: this.state.tick + 1, elapsedSeconds: nextElapsedSeconds };
      return;
    }

    const halfWidth = tuning.trackHalfWidth;
    const currentX = Math.max(-halfWidth, Math.min(halfWidth, this.state.player.x));
    const targetX = Math.max(-halfWidth, Math.min(halfWidth, input.targetX));
    const maxHorizontalDelta = tuning.moveSpeed * dtSeconds;
    const difference = targetX - currentX;
    const nextX = Math.abs(difference) <= maxHorizontalDelta
      ? targetX
      : currentX + Math.sign(difference) * maxHorizontalDelta;
    const nextZ = this.state.player.z + tuning.forwardSpeed * dtSeconds;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) {
      throw new Error('Simulation movement exceeds the supported range');
    }
    const enemies = this.state.enemies.map((enemy) => ({ ...enemy }));
    const gates = this.state.gates.map((gate) => ({ ...gate, reward: { ...gate.reward } }));
    let squad = { ...this.state.squad };
    const projectiles = this.state.projectiles.map((projectile) => ({ ...projectile }));
    let nextProjectileId = this.state.weapons.nextProjectileId;
    const offsets = createSquadFormation(this.state.squad.count, tuning.formationSpacing);
    const rifleCount = this.state.squad.count - this.state.squad.rocketCount;
    const nextCooldowns = { rifle: this.state.weapons.rifleCooldownRemainingSeconds,
      rocket: this.state.weapons.rocketCooldownRemainingSeconds };
    // Fire before travel; projectiles created this tick travel for this full fixed step.
    for (const kind of ['rifle', 'rocket'] as const) {
      const activeOffsets = kind === 'rifle' ? offsets.slice(0, rifleCount) : offsets.slice(rifleCount);
      const weapon = tuning[kind];
      const interval = 1 / weapon.fireRate;
      if (!positiveFinite(interval)) throw new Error('Simulation fire interval exceeds the supported range');
      if (activeOffsets.length === 0) {
        nextCooldowns[kind] = 0;
        continue;
      }
      let cooldown = nextCooldowns[kind] - dtSeconds;
      // A malformed direct step must not turn into an unbounded catch-up loop.
      if (cooldown <= 0 && Math.floor(-cooldown / interval) + 1 > 10_000) {
        throw new Error('Simulation step requests too many weapon volleys');
      }
      while (cooldown <= 0) {
        for (const offset of activeOffsets) {
          if (!Number.isSafeInteger(nextProjectileId) || nextProjectileId <= 0) throw new Error('Simulation projectile ID exceeds the supported range');
          const x = nextX + offset.x;
          const z = nextZ + offset.z;
          if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Simulation projectile origin is non-finite');
          projectiles.push({ id: nextProjectileId++, kind, x, z, speed: weapon.projectileSpeed,
            damage: weapon.damage, remainingRange: weapon.range,
            blastRadius: kind === 'rocket' ? tuning.rocket.blastRadius : 0 });
        }
        cooldown += interval;
        if (!Number.isFinite(cooldown)) throw new Error('Simulation weapon cooldown exceeds the supported range');
      }
      nextCooldowns[kind] = cooldown;
    }
    if (!Number.isSafeInteger(nextProjectileId)) throw new Error('Simulation projectile ID exceeds the supported range');

    const survivingProjectiles: ProjectileSimulationState[] = [];
    for (const projectile of projectiles) {
      const travel = Math.min(projectile.speed * dtSeconds, projectile.remainingRange);
      const endZ = projectile.z + travel;
      if (!Number.isFinite(travel) || !Number.isFinite(endZ)) throw new Error('Simulation projectile movement exceeds the supported range');
      const hit = findFirstHit(projectile, endZ, enemies, gates, tuning.gruntRadius);
      if (hit) {
        if (hit.kind === 'gate') {
          hit.gate.hp -= projectile.damage;
          if (hit.gate.hp <= 0) {
            const amount = hit.gate.reward.amount;
            if (!Number.isSafeInteger(squad.count + amount)
              || (hit.gate.reward.kind === 'rocket' && !Number.isSafeInteger(squad.rocketCount + amount))) {
              throw new Error('Simulation squad reward exceeds the supported range');
            }
            squad.count += amount;
            if (hit.gate.reward.kind === 'rocket') squad.rocketCount += amount;
            for (let index = gates.length - 1; index >= 0; index--) {
              if (gates[index].choiceGroup === hit.gate.choiceGroup) gates.splice(index, 1);
            }
          }
        } else if (projectile.kind === 'rifle') {
          hit.enemy.hp -= projectile.damage;
          if (hit.enemy.hp <= 0) enemies.splice(enemies.indexOf(hit.enemy), 1);
        }
        if (projectile.kind === 'rocket') {
          const radiusSquared = projectile.blastRadius * projectile.blastRadius;
          const blastX = hit.kind === 'gate' ? projectile.x : hit.enemy.x;
          const blastZ = hit.kind === 'gate' ? hit.gate.z : hit.enemy.z;
          // Only enemies receive blast damage; ID order makes multi-target resolution stable.
          for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
            const dx = enemy.x - blastX;
            const dz = enemy.z - blastZ;
            if (dx * dx + dz * dz <= radiusSquared) {
              enemy.hp -= projectile.damage;
              if (enemy.hp <= 0) enemies.splice(enemies.indexOf(enemy), 1);
            }
          }
        }
        continue;
      }
      const remainingRange = projectile.remainingRange - travel;
      if (remainingRange > 0) survivingProjectiles.push({ ...projectile, z: endZ, remainingRange });
    }
    // The last volley may still open a gate on the step that reaches its Z.
    const passedGroups = new Set(gates.filter((gate) => nextZ >= gate.z).map((gate) => gate.choiceGroup));
    for (let index = gates.length - 1; index >= 0; index--) {
      if (passedGroups.has(gates[index].choiceGroup)) gates.splice(index, 1);
    }
    const contactRadius = tuning.memberRadius + tuning.gruntRadius;
    if (!positiveFinite(contactRadius)) throw new Error('Simulation contact radius exceeds the supported range');
    // Contact follows projectile deaths; each removed enemy can cause at most one casualty event.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      // Sweep each moving squad member against the stationary enemy.
      const contact = createSquadFormation(squad.count, tuning.formationSpacing).some((offset) => {
        const startX = this.state.player.x + offset.x;
        const startZ = this.state.player.z + offset.z;
        const endX = nextX + offset.x;
        const endZ = nextZ + offset.z;
        if (![startX, startZ, endX, endZ].every(Number.isFinite)) {
          throw new Error('Simulation squad contact position is non-finite');
        }
        return segmentTouchesCircle(startX, startZ, endX, endZ, enemy.x, enemy.z, contactRadius);
      });
      if (contact) {
        enemies.splice(enemies.indexOf(enemy), 1);
        squad = afterCasualties(squad, tuning.gruntContactDamage);
      }
    }
    const defenseLineZ = nextZ - tuning.defenseLineOffset;
    if (!Number.isFinite(defenseLineZ)) throw new Error('Simulation defense line exceeds the supported range');
    // Only survivors can leak; contact and projectile kills have already removed their enemies.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squad.count === 0) break;
      if (enemy.z <= defenseLineZ) {
        enemies.splice(enemies.indexOf(enemy), 1);
        squad = afterCasualties(squad, 1);
      }
    }
    this.state = { ...this.state, player: { x: nextX, z: nextZ }, squad, enemies, gates, projectiles: survivingProjectiles,
      weapons: { rifleCooldownRemainingSeconds: nextCooldowns.rifle, rocketCooldownRemainingSeconds: nextCooldowns.rocket,
        nextProjectileId }, tick: this.state.tick + 1,
      elapsedSeconds: nextElapsedSeconds, rngState: this.rng.getState() };
  }

  getState(): SimulationState {
    return {
      ...this.state,
      rngState: this.rng.getState(),
      player: { ...this.state.player },
      squad: { ...this.state.squad },
      enemies: this.state.enemies.map((enemy) => ({ ...enemy })),
      gates: this.state.gates.map((gate) => ({ ...gate, reward: { ...gate.reward } })),
      projectiles: this.state.projectiles.map((projectile) => ({ ...projectile })),
      weapons: { ...this.state.weapons },
    };
  }

  restoreState(state: SimulationState): void {
    const candidate = validateState(state);
    this.state = candidate.state;
    this.rng = candidate.rng;
  }
}
