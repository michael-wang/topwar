import { describe, expect, it } from 'vitest';
import { DEATH_DURATION_SECONDS, DEATH_GRAY_SECONDS, deathPose, SHOWCASE_HEIGHT, SHOWCASE_WIDTH, VIEWS } from '../src/art-showcase/spec';
import { createToySoldier, disposeSoldier, poseRunning } from '../src/art-showcase/ToySoldier';

describe('isolated art showcase', () => {
  it('uses a fixed portrait output and all requested review views', () => {
    expect([SHOWCASE_WIDTH, SHOWCASE_HEIGHT]).toEqual([720, 1280]);
    expect(VIEWS.map((view) => view.id)).toEqual([
      'comparison', 'player', 'player-side', 'enemy', 'running', 'boss', 'projectile', 'death',
    ]);
  });

  it('grays quickly, rises, and fully fades in the requested time', () => {
    expect(deathPose(0)).toEqual({ gray: 0, rise: 0, opacity: 1 });
    expect(deathPose(DEATH_GRAY_SECONDS).gray).toBe(1);
    expect(deathPose(0.3).rise).toBeGreaterThan(1);
    expect(deathPose(DEATH_DURATION_SECONDS).opacity).toBe(0);
  });

  it('keeps the gun on the player, with its muzzle along the forward +Z axis', () => {
    const player = createToySoldier('player');
    const enemy = createToySoldier('enemy');
    expect(player.muzzle).not.toBeNull();
    expect(player.muzzle!.getWorldPosition(player.muzzle!.position.clone()).z).toBeGreaterThan(1);
    expect(enemy.muzzle).toBeNull();
    disposeSoldier(player);
    disposeSoldier(enemy);
  });

  it('runs with opposite arm and leg swings and scales the Boss up', () => {
    const enemy = createToySoldier('enemy');
    const boss = createToySoldier('enemy', true);
    poseRunning(enemy, 0.1);
    expect(enemy.arms[0].rotation.x).toBeCloseTo(-enemy.arms[1].rotation.x);
    expect(enemy.legs[0].rotation.x).toBeCloseTo(-enemy.legs[1].rotation.x);
    expect(Math.abs(enemy.arms[0].rotation.x)).toBeGreaterThan(0.7);
    expect(boss.root.scale.y).toBeGreaterThan(2);
    expect(boss.helmet.scale.x).toBeLessThan(1);
    expect(enemy.helmet.position.y).toBeLessThan(2.9);
    disposeSoldier(enemy);
    disposeSoldier(boss);
  });
});
