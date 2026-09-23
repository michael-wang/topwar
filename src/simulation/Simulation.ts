import { SeededRng } from '../core/Rng';
import { LevelDefinitionSchema, type LevelDefinition } from '../level/LevelDefinition';
import { createEnemyFormation } from './enemies/formation';
import { createSquadFormation } from './squad/formation';
import type { EnemySimulationState, ProjectileSimulationState, SimulationState } from './SimulationState';

export interface SimulationOptions {
  seed: number;
  level: LevelDefinition;
  startSquad: number;
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
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function findFirstHit(projectile: ProjectileSimulationState, endZ: number,
  enemies: EnemySimulationState[], radius: number): EnemySimulationState | undefined {
  let first: EnemySimulationState | undefined;
  let firstZ = Infinity;
  for (const enemy of enemies) {
    const dx = projectile.x - enemy.x;
    if (Math.abs(dx) > radius) continue;
    const halfChord = Math.sqrt(radius * radius - dx * dx);
    const entryZ = enemy.z - halfChord;
    const exitZ = enemy.z + halfChord;
    if (exitZ < projectile.z || entryZ > endZ) continue;
    const hitZ = Math.max(projectile.z, entryZ);
    if (hitZ < firstZ || (hitZ === firstZ && first && enemy.id < first.id)) {
      first = enemy;
      firstZ = hitZ;
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
  const fields = ['tick', 'elapsedSeconds', 'levelId', 'seed', 'rngState', 'player', 'squad', 'enemies', 'projectiles', 'rifle'];
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
  if (Object.keys(squad).length !== 1 || !Object.hasOwn(squad, 'count')) {
    throw new Error('Simulation squad must contain only count');
  }
  if (!validSquadCount(squad.count)) {
    throw new Error('Simulation squad.count must be a non-negative safe integer');
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

  if (!Array.isArray(state.projectiles)) throw new Error('Simulation projectiles must be an array');
  const projectileIds = new Set<number>();
  const projectiles: ProjectileSimulationState[] = state.projectiles.map((value: unknown, index: number) => {
    if (!isPlainObject(value)) throw new Error(`Simulation projectile ${index} must be a plain object`);
    if (Object.keys(value).length !== 6 || ['id', 'x', 'z', 'speed', 'damage', 'remainingRange'].some((field) => !Object.hasOwn(value, field))) {
      throw new Error(`Simulation projectile ${index} has missing or unknown fields`);
    }
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || projectileIds.has(value.id as number)) {
      throw new Error(`Simulation projectile ${index} id must be unique and positive`);
    }
    projectileIds.add(value.id as number);
    if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.z !== 'number' || !Number.isFinite(value.z)) {
      throw new Error(`Simulation projectile ${index} position must be finite`);
    }
    if (!positiveFinite(value.speed) || !positiveFinite(value.damage) || !positiveFinite(value.remainingRange)) {
      throw new Error(`Simulation projectile ${index} speed, damage, and remainingRange must be positive and finite`);
    }
    return { id: value.id as number, x: value.x, z: value.z, speed: value.speed, damage: value.damage, remainingRange: value.remainingRange };
  });
  if (!isPlainObject(state.rifle) || Object.keys(state.rifle).length !== 2
    || !Object.hasOwn(state.rifle, 'cooldownRemainingSeconds') || !Object.hasOwn(state.rifle, 'nextProjectileId')) {
    throw new Error('Simulation rifle must contain cooldownRemainingSeconds and nextProjectileId');
  }
  if (typeof state.rifle.cooldownRemainingSeconds !== 'number' || !Number.isFinite(state.rifle.cooldownRemainingSeconds)
    || state.rifle.cooldownRemainingSeconds < 0) throw new Error('Simulation rifle cooldown must be finite and non-negative');
  const nextProjectileId = state.rifle.nextProjectileId;
  if (!Number.isSafeInteger(nextProjectileId) || (nextProjectileId as number) <= 0
    || projectiles.some((projectile) => projectile.id >= (nextProjectileId as number))) {
    throw new Error('Simulation rifle nextProjectileId must exceed active projectile IDs');
  }

  return {
    state: {
      tick: state.tick as number,
      elapsedSeconds: state.elapsedSeconds,
      levelId: state.levelId,
      seed: state.seed as number,
      rngState: rng.getState(),
      player: { x: player.x, z: player.z },
      squad: { count: squad.count },
      enemies,
      projectiles,
      rifle: { cooldownRemainingSeconds: state.rifle.cooldownRemainingSeconds, nextProjectileId: nextProjectileId as number },
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
    if (!positiveFinite(options.gruntHp)) throw new Error('Simulation gruntHp must be positive and finite');
    const enemies: EnemySimulationState[] = [];
    for (const group of level.enemyGroups) {
      for (const offset of createEnemyFormation(group.count, group.formation.columns, group.formation.spacing)) {
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
      squad: { count: options.startSquad },
      enemies,
      projectiles: [],
      rifle: { cooldownRemainingSeconds: 0, nextProjectileId: 1 },
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
    const projectiles = this.state.projectiles.map((projectile) => ({ ...projectile }));
    let nextProjectileId = this.state.rifle.nextProjectileId;
    let cooldown = this.state.rifle.cooldownRemainingSeconds - dtSeconds;
    const interval = 1 / tuning.rifle.fireRate;
    if (!positiveFinite(interval)) throw new Error('Simulation fire interval exceeds the supported range');
    // A malformed direct step must not turn into an unbounded catch-up loop.
    if (cooldown <= 0 && Math.floor(-cooldown / interval) + 1 > 10_000) {
      throw new Error('Simulation step requests too many rifle volleys');
    }
    // Fire before travel; bullets created this tick travel for this full fixed step.
    while (cooldown <= 0) {
      for (const offset of createSquadFormation(this.state.squad.count, tuning.formationSpacing)) {
        if (!Number.isSafeInteger(nextProjectileId) || nextProjectileId <= 0) throw new Error('Simulation projectile ID exceeds the supported range');
        const x = nextX + offset.x;
        const z = nextZ + offset.z;
        if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Simulation projectile origin is non-finite');
        projectiles.push({ id: nextProjectileId++, x, z, speed: tuning.rifle.projectileSpeed,
          damage: tuning.rifle.damage, remainingRange: tuning.rifle.range });
      }
      cooldown += interval;
      if (!Number.isFinite(cooldown)) throw new Error('Simulation rifle cooldown exceeds the supported range');
    }
    if (!Number.isSafeInteger(nextProjectileId)) throw new Error('Simulation projectile ID exceeds the supported range');

    const survivingProjectiles: ProjectileSimulationState[] = [];
    for (const projectile of projectiles) {
      const travel = Math.min(projectile.speed * dtSeconds, projectile.remainingRange);
      const endZ = projectile.z + travel;
      if (!Number.isFinite(travel) || !Number.isFinite(endZ)) throw new Error('Simulation projectile movement exceeds the supported range');
      const hit = findFirstHit(projectile, endZ, enemies, tuning.gruntRadius);
      if (hit) {
        hit.hp -= projectile.damage;
        if (hit.hp <= 0) enemies.splice(enemies.indexOf(hit), 1);
        continue;
      }
      const remainingRange = projectile.remainingRange - travel;
      if (remainingRange > 0) survivingProjectiles.push({ ...projectile, z: endZ, remainingRange });
    }
    const contactRadius = tuning.memberRadius + tuning.gruntRadius;
    if (!positiveFinite(contactRadius)) throw new Error('Simulation contact radius exceeds the supported range');
    let squadCount = this.state.squad.count;
    // Contact follows projectile deaths; each removed enemy can cause at most one casualty event.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squadCount === 0) break;
      // Sweep each moving squad member against the stationary enemy.
      const contact = createSquadFormation(squadCount, tuning.formationSpacing).some((offset) => {
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
        squadCount = Math.max(0, squadCount - tuning.gruntContactDamage);
      }
    }
    const defenseLineZ = nextZ - tuning.defenseLineOffset;
    if (!Number.isFinite(defenseLineZ)) throw new Error('Simulation defense line exceeds the supported range');
    // Only survivors can leak; contact and projectile kills have already removed their enemies.
    for (const enemy of [...enemies].sort((first, second) => first.id - second.id)) {
      if (squadCount === 0) break;
      if (enemy.z <= defenseLineZ) {
        enemies.splice(enemies.indexOf(enemy), 1);
        squadCount = Math.max(0, squadCount - 1);
      }
    }
    this.state = { ...this.state, player: { x: nextX, z: nextZ }, squad: { count: squadCount }, enemies, projectiles: survivingProjectiles,
      rifle: { cooldownRemainingSeconds: cooldown, nextProjectileId }, tick: this.state.tick + 1,
      elapsedSeconds: nextElapsedSeconds, rngState: this.rng.getState() };
  }

  getState(): SimulationState {
    return {
      ...this.state,
      rngState: this.rng.getState(),
      player: { ...this.state.player },
      squad: { ...this.state.squad },
      enemies: this.state.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.state.projectiles.map((projectile) => ({ ...projectile })),
      rifle: { ...this.state.rifle },
    };
  }

  restoreState(state: SimulationState): void {
    const candidate = validateState(state);
    this.state = candidate.state;
    this.rng = candidate.rng;
  }
}
