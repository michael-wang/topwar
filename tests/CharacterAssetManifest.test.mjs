import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LEGACY_MODEL_FILES, loadCharacterAssets } from '../src/rendering/CharacterAssets';

describe('current legacy asset boundary', () => {
  it('matches the public GLBs exactly, with complete Boss motion and shared resources', () => {
    const names = Object.values(LEGACY_MODEL_FILES).map(name => `toy-soldier-${name}.glb`);
    const disk = readdirSync('public/models').filter(name => name.endsWith('.glb'));
    expect(names).toHaveLength(13);
    expect(new Set(names).size).toBe(names.length);
    expect(disk.sort()).toEqual(names.sort());
    expect(names.reduce((bytes, name) => bytes + statSync(`public/models/${name}`).size, 0)).toBe(356172);
    for (let pose = 0; pose < 4; pose++) {
      expect(names).toContain(`toy-soldier-boss-run-${pose}.glb`);
      expect(names).toContain(`toy-soldier-boss-slam-${pose}.glb`);
    }
  });

  it('fails clearly when a required asset has no usable mesh', async () => {
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({
      scene: new THREE.Group(),
    });
    try {
      await expect(loadCharacterAssets()).rejects.toThrow('gray-body must have one mesh; got 0');
    } finally { load.mockRestore(); }
  });
});

