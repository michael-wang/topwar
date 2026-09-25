import { describe, expect, it } from 'vitest';
import { publicAssetUrl } from '../src/core/publicAssetUrl';

describe('public asset URLs', () => {
  it('resolves authored data under the local and GitHub Pages bases', () => {
    expect(publicAssetUrl('game-data/game.json', '/')).toBe('/game-data/game.json');
    expect(publicAssetUrl('game-data/game.json', '/topwar/')).toBe('/topwar/game-data/game.json');
    expect(publicAssetUrl('game-data/levels/level-001.json', '/topwar/'))
      .toBe('/topwar/game-data/levels/level-001.json');
    expect(publicAssetUrl('/game-data/game.json', '/topwar/'))
      .toBe('/topwar/game-data/game.json');
  });
});
