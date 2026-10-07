import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicAssetUrl } from '../src/core/publicAssetUrl';

describe('public asset URLs', () => {
  beforeEach(() => vi.stubEnv('PROD', false));
  afterEach(() => vi.unstubAllEnvs());

  it('resolves authored data under the local and GitHub Pages bases', () => {
    expect(publicAssetUrl('game-data/game.json', '/')).toBe('/game-data/game.json');
    expect(publicAssetUrl('game-data/game.json', '/topwar/')).toBe('/topwar/game-data/game.json');
    expect(publicAssetUrl('game-data/levels/level-001.json', '/topwar/'))
      .toBe('/topwar/game-data/levels/level-001.json');
    expect(publicAssetUrl('/game-data/game.json', '/topwar/'))
      .toBe('/topwar/game-data/game.json');
  });

  it('versions production data and models using the injected build SHA', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('BASE_URL', '/topwar/');
    for (const path of ['game-data/game.json', 'game-data/levels/level-001.json', 'models/toy-soldier-bullet.glb']) {
      expect(publicAssetUrl(path)).toBe(`/topwar/${path}?v=${__TOPWAR_SHA__}`);
    }
  });

  it('keeps production base and leading/trailing slash normalization', () => {
    vi.stubEnv('PROD', true);
    expect(publicAssetUrl('///game-data/game.json', '/topwar///'))
      .toBe(`/topwar/game-data/game.json?v=${__TOPWAR_SHA__}`);
    expect(publicAssetUrl('/game-data/game.json', '/'))
      .toBe(`/game-data/game.json?v=${__TOPWAR_SHA__}`);
  });

  it('preserves query values and fragments while replacing duplicate versions', () => {
    vi.stubEnv('PROD', true);
    expect(publicAssetUrl('models/item.glb?quality=high&v=old&v=older#mesh', '/topwar/'))
      .toBe(`/topwar/models/item.glb?quality=high&v=${__TOPWAR_SHA__}#mesh`);
    expect(publicAssetUrl('game-data/game.json?name=warm%20coast#v=fragment', '/topwar/'))
      .toBe(`/topwar/game-data/game.json?name=warm+coast&v=${__TOPWAR_SHA__}#v=fragment`);
    expect(publicAssetUrl('game-data/game.json?', '/topwar/'))
      .toBe(`/topwar/game-data/game.json?v=${__TOPWAR_SHA__}`);
  });

  it('does not add or rewrite development query parameters', () => {
    expect(publicAssetUrl('game-data/game.json?v=local&debug=1#data', '/'))
      .toBe('/game-data/game.json?v=local&debug=1#data');
  });
});
