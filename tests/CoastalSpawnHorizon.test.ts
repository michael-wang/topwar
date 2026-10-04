import { expect, it } from 'vitest';
import * as THREE from 'three';
import data from '../public/game-data/game.json';
import levelData from '../public/game-data/levels/level-001.json';
import { ART } from '../src/art/ArtDirection';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import { Simulation } from '../src/simulation/Simulation';
import { laneCompositionForRow } from '../src/simulation/enemies/laneComposition';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

const config = GameConfigSchema.parse(data), balance = config.catharsis!, level = LevelDefinitionSchema.parse(levelData);
const make = (distance: number) => new Simulation({ seed: 17, level, startSquad: 1, startRocketCount: 0,
  tiers: config.tiers, catharsis: { balance: { ...balance, defenseSpawnAheadDistance: distance }, trackHalfWidth: 3.2 } });

it('uses the reviewed Z45 shore and Z47 buffering without moving the earliest stream row', () => {
  expect(ART.coastalDefense.shorelineZ).toBe(45);
  expect(balance.defenseSpawnAheadDistance).toBe(47); expect(level.enemyStream!.startZ).toBe(30);
  const old = make(53).getState(), current = make(47).getState();
  expect(old.enemies).toHaveLength(168); expect(current.enemies).toHaveLength(120);
  expect(current.enemies).toEqual(old.enemies.slice(0, 120));
  expect(Math.min(...current.enemies.map(e => e.z))).toBe(Math.min(...old.enemies.map(e => e.z)));
});

it('bounds every row offset and new buffered foot within the shallow entry envelope', () => {
  const shore = ART.coastalDefense.shorelineZ;
  for (let row = 0; row < 2400; row++) {
    for (const member of laneCompositionForRow(row, level.enemyStream!.seed, balance, 3.2)) {
      expect(member.z).toBeLessThanOrEqual(0); expect(member.z).toBeGreaterThanOrEqual(-balance.crowdDepthSpan);
      expect(balance.defenseSpawnAheadDistance + member.z).toBeLessThanOrEqual(shore + 2.5);
    }
  }
  const sim = make(47);
  const tuning = { moveSpeed: config.player.moveSpeed, forwardSpeed: config.player.forwardSpeed, trackHalfWidth: 3.2,
    defenseLineOffset: 1.5, formationSpacing: .45, memberRadius: .22, normalEnemyRadius: .3, bossRadius: 2,
    rifle: config.weapon.rifle, rocket: config.weapon.rocket };
  for (let advance = 0; advance < 60; advance++) {
    const state = sim.getState(), nextId = state.enemyStream!.nextEnemyId; state.player.z += 2.2; sim.restoreState(state);
    sim.step(1 / 60, { targetX: 0 }, tuning); const next = sim.getState();
    for (const enemy of next.enemies.filter(e => e.id >= nextId)) expect(enemy.z - next.player.z).toBeLessThanOrEqual(shore + 2.5);
  }
});

it('anchors the sand far edge and landing craft endpoint to the visual shore', () => {
  const scene = new THREE.Scene(), environment = new BridgeEnvironment(scene); environment.update(0, 3.2, 0, true);
  const sand = scene.getObjectByName('defense-sand') as THREE.Mesh; sand.updateMatrixWorld();
  expect(new THREE.Box3().setFromObject(sand).max.z).toBeCloseTo(ART.coastalDefense.shorelineZ);
  expect(new THREE.Box3().setFromObject(sand).min.z).toBeCloseTo(-47);
  environment.dispose(); expect(scene.children).toHaveLength(0);
});
