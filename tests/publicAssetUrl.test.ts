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

  it('versions production data and models using their content manifest', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('BASE_URL', '/topwar/');
    for (const path of ['game-data/game.json', 'game-data/levels/level-001.json', 'models/toy-soldier-bullet.glb']) {
      expect(publicAssetUrl(path)).toBe(`/topwar/${__TOPWAR_PUBLIC_ASSETS__[path]}`);
    }
  });

  it('keeps production base and leading/trailing slash normalization', () => {
    vi.stubEnv('PROD', true);
    expect(publicAssetUrl('///game-data/game.json', '/topwar///'))
      .toBe(`/topwar/${__TOPWAR_PUBLIC_ASSETS__['game-data/game.json']}`);
    expect(publicAssetUrl('/game-data/game.json', '/'))
      .toBe(`/${__TOPWAR_PUBLIC_ASSETS__['game-data/game.json']}`);
  });

  it('preserves query values and fragments while replacing duplicate versions', () => {
    vi.stubEnv('PROD', true);
    expect(publicAssetUrl('models/toy-soldier-bullet.glb?quality=high&v=old&v=older#mesh', '/topwar/'))
      .toBe(`/topwar/${__TOPWAR_PUBLIC_ASSETS__['models/toy-soldier-bullet.glb']}?quality=high#mesh`);
    expect(publicAssetUrl('game-data/game.json?name=warm%20coast#v=fragment', '/topwar/'))
      .toBe(`/topwar/${__TOPWAR_PUBLIC_ASSETS__['game-data/game.json']}?name=warm+coast#v=fragment`);
    expect(publicAssetUrl('game-data/game.json?', '/topwar/'))
      .toBe(`/topwar/${__TOPWAR_PUBLIC_ASSETS__['game-data/game.json']}`);
  });

  it('fails loudly for a public file missing from the matching build', () => {
    vi.stubEnv('PROD', true);
    expect(() => publicAssetUrl('models/missing.glb')).toThrow('missing from the build manifest');
  });

  it('does not add or rewrite development query parameters', () => {
    expect(publicAssetUrl('game-data/game.json?v=local&debug=1#data', '/'))
      .toBe('/game-data/game.json?v=local&debug=1#data');
  });
});
