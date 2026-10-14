import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyDevCameraPerspective } from '../src/rendering/DevCameraPerspective';
import { coastalCameraFov } from '../src/rendering/renderSize';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { createSurvivalReview } from '../src/app/DevSurvivalReview';
import data from './helpers/ShippingConfig';
import level from '../public/game-data/levels/level-001.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';

it.each([350, 390])('preserves A and near-player composition, widens distant lanes at %ipx and survives resize', width => {
  const camera = new PerspectiveCamera(coastalCameraFov(width / 844), width / 844, .1, 180);
  camera.position.set(0, 6.5, -10); camera.lookAt(0, 0, 12.5); camera.updateMatrixWorld();
  const original = camera.clone();
  applyDevCameraPerspective(camera, 'A');
  expect(camera.projectionMatrix.elements).toEqual(original.projectionMatrix.elements);
  expect(camera.matrixWorld.elements).toEqual(original.matrixWorld.elements);
  const project = (x: number, y: number, z: number) => new Vector3(x, y, z).project(camera);
  const body = project(1.5, .8, 0), feet = project(0, 0, 0), head = project(0, 1.6, 0);
  const lane = project(1, 0, 40).x;
  applyDevCameraPerspective(camera, 'B');
  expect(camera.position.distanceTo(original.position)).toBeCloseTo(4);
  expect(project(1.5, .8, 0).distanceTo(body)).toBeLessThan(.01); // Includes changed depth.
  expect(Math.abs(project(1.5, .8, 0).y - body.y) * 422).toBeLessThan(.01);
  expect(Math.abs((project(0, 1.6, 0).y - project(0, 0, 0).y) / (head.y - feet.y) - 1)).toBeLessThan(.03);
  expect(project(1, 0, 40).x / lane).toBeGreaterThan(1.2);
  expect(project(1, 0, 40).x / lane).toBeLessThan(1.26);
  camera.aspect = (width === 350 ? 390 : 350) / 844;
  applyDevCameraPerspective(camera, 'B');
  applyDevCameraPerspective(camera, 'A');
  expect(camera.fov).toBe(coastalCameraFov(camera.aspect));
  expect(camera.matrixWorld.elements).toEqual(original.matrixWorld.elements);
});

it('reuses the exact fixed-seed Lv8 AHEAD fixture without changing crowd or gameplay configuration', () => {
  const c = GameConfigSchema.parse(data);
  const options = { seed: 99, level: LevelDefinitionSchema.parse(level), startSquad: 1, startRocketCount: 0,
    tiers: c.tiers, catharsis: { balance: c.catharsis!, trackHalfWidth: c.track.halfWidth } };
  const actual = createDevReviewFixture(options, c.weapon.rifle.fireRate, 'camera-ab').getState();
  expect(actual).toEqual(createSurvivalReview(options, c.weapon.rifle.fireRate, 'survival8-ahead', 17).getState());
  expect(actual.enemies).toHaveLength(42);
});
