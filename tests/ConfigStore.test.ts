import { afterEach, describe, expect, it, vi } from 'vitest';
import baseJson from '../public/game-data/game.json';
import { ConfigStore, type ConfigStorage } from '../src/config/ConfigStore';
import { GameConfigSchema, type GameConfig } from '../src/config/configSchema';
import type { DeepPartial } from '../src/config/configTypes';

const storageKey = 'topwar:config-overrides:v1';
const sourceUrl = '/game-data/game.json';
const base = GameConfigSchema.parse(baseJson);

function memoryStorage(): ConfigStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

function storeWithData(data: unknown = baseJson, storage?: ConfigStorage) {
  const fetchJson = vi.fn(async () => structuredClone(data));
  return { store: new ConfigStore({ fetchJson, storage }), fetchJson };
}

afterEach(() => vi.unstubAllGlobals());

describe('GameConfigSchema and loading', () => {
  it('loads the external JSON through the injected loader and rejects access before load', async () => {
    const { store, fetchJson } = storeWithData();
    expect(() => store.getConfig()).toThrow(/load\(\)/);
    await store.load();
    expect(fetchJson).toHaveBeenCalledWith(sourceUrl);
    expect(store.getConfig()).toEqual(base);
    expect(store.getConfig().weapon.rifle.range).toBe(40);
    expect(store.getConfig().player).toMatchObject({ startSquad: 1, startRocketCount: 0 });
    expect(store.getConfig().player.forwardSpeed).toBe(1.5);
    expect(store.getConfig().weapon.rocket).toEqual({ damage: 15, fireRate: 0.6,
      projectileSpeed: 18, range: 40, blastRadius: 1.25 });
    expect(store.getConfig().enemies.grunt.hp).toBe(3);
    expect(store.getConfig().enemies.brute).toEqual({ hp: 300, radius: 0.3 });
    expect(store.getConfig().enemies.tier3).toEqual({ hp: 3000, radius: 0.3 });
    expect(store.getConfig().weapon.rifle.damage).toBe(3);
  });

  it('rejects invalid base values, string coercion, and unknown keys', async () => {
    const invalid = structuredClone(base) as GameConfig & { surprise?: boolean };
    invalid.weapon.rifle.damage = 0;
    await expect(storeWithData(invalid).store.load()).rejects.toThrow(/damage/);
    await expect(storeWithData({ ...base, surprise: true }).store.load()).rejects.toThrow(/surprise/);
    await expect(storeWithData({ ...base, player: { ...base.player, moveSpeed: '5' } }).store.load()).rejects.toThrow(/moveSpeed/);
    await expect(storeWithData({ ...base, player: { ...base.player, extra: 1 } }).store.load()).rejects.toThrow(/extra/);
  });

  it('enforces the numeric field boundaries', () => {
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, startSquad: 0, moveSpeed: 0 } })).not.toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, forwardSpeed: 0 } })).not.toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, forwardSpeed: -1 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, forwardSpeed: Infinity } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, track: { ...base.track, halfWidth: 0 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, track: { ...base.track, halfWidth: 1.5 } })).not.toThrow();
    expect(() => GameConfigSchema.parse({ ...base, track: { ...base.track, defenseLineOffset: 0 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, track: { ...base.track, defenseLineOffset: Infinity } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, controls: { mouseSensitivity: 0 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, controls: { mouseSensitivity: Infinity } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, controls: { mouseSensitivity: 1.5 } })).not.toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, startSquad: 1.5 } })).toThrow();
    for (const startRocketCount of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 2]) {
      expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, startRocketCount } })).toThrow(/startRocketCount/);
    }
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, startSquad: 2, startRocketCount: 2 } })).not.toThrow();
    for (const key of ['damage', 'fireRate', 'projectileSpeed', 'range', 'blastRadius'] as const) {
      expect(() => GameConfigSchema.parse({ ...base, weapon: { ...base.weapon,
        rocket: { ...base.weapon.rocket, [key]: 0 } } })).toThrow();
    }
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, formationSpacing: 0 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, memberRadius: 0 } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, memberRadius: Infinity } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, player: { ...base.player, memberRadius: 0.22 } })).not.toThrow();
    for (const obsolete of [{ moveSpeed: 2.5 }, { activationDistance: 10 }]) {
      expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies, grunt: { ...base.enemies.grunt, ...obsolete } } })).toThrow();
    }
    expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies,
      grunt: { ...base.enemies.grunt, contactDamage: 1 } } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies, grunt: { ...base.enemies.grunt, hp: Infinity } } })).toThrow();
    for (const hp of [0, -1, Infinity, NaN]) {
      expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies,
        brute: { ...base.enemies.brute, hp } } })).toThrow();
    }
    expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies,
      brute: { ...base.enemies.brute, contactDamage: 1 } } })).toThrow();
    for (const radius of [0, -1, Infinity, NaN]) {
      expect(() => GameConfigSchema.parse({ ...base, enemies: { ...base.enemies,
        brute: { ...base.enemies.brute, radius } } })).toThrow();
    }
    expect(() => GameConfigSchema.parse({ ...base, bosses: { basic: { ...base.bosses.basic, radius: -1 } } })).toThrow();
  });

  it('reports the URL for failed HTTP and malformed JSON responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('{', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const store = new ConfigStore({ sourceUrl: '/missing.json' });
    await expect(store.load()).rejects.toThrow(/\/missing\.json.*HTTP 404/);
    await expect(store.load()).rejects.toThrow(/\/missing\.json/);
    expect(fetchMock).toHaveBeenCalledWith('/missing.json');
    expect(() => store.getConfig()).toThrow(/load\(\)/);
  });
});

describe('ConfigStore overrides', () => {
  it('deep-merges nested patches across updates and replaces all overrides when requested', async () => {
    const { store } = storeWithData();
    await store.load();
    store.updateOverrides({ player: { moveSpeed: 8 } });
    store.updateOverrides({ weapon: { rifle: { damage: 9 } } });
    expect(store.getConfig().weapon.rifle).toEqual({ ...base.weapon.rifle, damage: 9 });
    expect(store.getConfig().player.moveSpeed).toBe(8);
    expect(store.getOverrides()).toEqual({ player: { moveSpeed: 8 }, weapon: { rifle: { damage: 9 } } });

    store.replaceOverrides({ enemies: { grunt: { hp: 20 } } });
    expect(store.getOverrides()).toEqual({ enemies: { grunt: { hp: 20 } } });
    expect(store.getConfig().player.moveSpeed).toBe(base.player.moveSpeed);
    expect(store.getConfig().enemies.grunt.hp).toBe(20);
    store.clearOverrides();
    expect(store.getConfig()).toEqual(base);
    expect(store.getOverrides()).toEqual({});
  });

  it('rejects bad updates and replacements without changing state, storage, or listeners', async () => {
    const storage = memoryStorage();
    const { store } = storeWithData(baseJson, storage);
    await store.load();
    store.updateOverrides({ player: { moveSpeed: 8 } });
    const notify = vi.fn();
    store.subscribe(notify);
    const persisted = storage.getItem(storageKey);
    const previous = store.getConfig();

    expect(() => store.updateOverrides({ weapon: { rifle: { damage: -1 } } })).toThrow(/damage/);
    expect(() => store.replaceOverrides({ player: { moveSpeed: 'fast' } } as unknown as DeepPartial<GameConfig>)).toThrow(/moveSpeed/);
    expect(() => store.updateOverrides({ stale: 1 } as unknown as DeepPartial<GameConfig>)).toThrow(/stale/);
    expect(() => store.replaceOverrides([] as unknown as DeepPartial<GameConfig>)).toThrow(/plain object/);
    expect(store.getConfig()).toEqual(previous);
    expect(store.getOverrides()).toEqual({ player: { moveSpeed: 8 } });
    expect(storage.getItem(storageKey)).toBe(persisted);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not let returned values, input patches, or listener arguments mutate internal state', async () => {
    const { store } = storeWithData();
    await store.load();
    const patch = { player: { moveSpeed: 8 } };
    store.updateOverrides(patch);
    patch.player.moveSpeed = 100;
    (store.getConfig() as GameConfig).player.moveSpeed = 200;
    store.getOverrides().player!.moveSpeed = 300;
    store.subscribe((config) => { (config as GameConfig).player.moveSpeed = 400; });
    store.updateOverrides({ weapon: { rifle: { damage: 4 } } });
    expect(store.getConfig().player.moveSpeed).toBe(8);
    expect(store.getOverrides().player?.moveSpeed).toBe(8);
  });
});

describe('ConfigStore persistence', () => {
  it('persists only overrides, restores them in a new store, and removes them on clear', async () => {
    const storage = memoryStorage();
    const first = storeWithData(baseJson, storage).store;
    await first.load();
    first.updateOverrides({ weapon: { rifle: { damage: 5 } } });
    expect(JSON.parse(storage.getItem(storageKey)!)).toEqual({ weapon: { rifle: { damage: 5 } } });

    const restored = storeWithData(baseJson, storage).store;
    await restored.load();
    expect(restored.getConfig().weapon.rifle.damage).toBe(5);
    restored.clearOverrides();
    expect(storage.getItem(storageKey)).toBeNull();
    expect(restored.getConfig()).toEqual(base);
  });

  it.each(['{', '[]', JSON.stringify({ player: { oldField: 1 } }), JSON.stringify({ player: { moveSpeed: -1 } })])(
    'discards corrupt or stale persisted overrides without blocking valid base config',
    async (saved) => {
      const storage = memoryStorage();
      storage.setItem(storageKey, saved);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { store } = storeWithData(baseJson, storage);
        await store.load();
        expect(store.getConfig()).toEqual(base);
        expect(storage.getItem(storageKey)).toBeNull();
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    },
  );
});

describe('ConfigStore reload and subscriptions', () => {
  it('reloads changed base JSON while retaining overrides and notifies only on changes', async () => {
    let current: unknown = baseJson;
    const fetchJson = vi.fn(async () => structuredClone(current));
    const store = new ConfigStore({ fetchJson });
    const listener = vi.fn();
    store.subscribe(listener);
    await store.load();
    expect(listener).not.toHaveBeenCalled();
    store.updateOverrides({ player: { moveSpeed: 8 } });
    expect(listener).toHaveBeenCalledTimes(1);

    current = { ...base, player: { ...base.player, startSquad: 3 },
      weapon: { ...base.weapon, rifle: { ...base.weapon.rifle, damage: 6 } } };
    await store.reloadBase();
    expect(store.getConfig().player).toEqual({ ...base.player, startSquad: 3, moveSpeed: 8 });
    expect(store.getConfig().weapon.rifle.damage).toBe(6);
    expect(store.getOverrides()).toEqual({ player: { moveSpeed: 8 } });
    expect(listener).toHaveBeenCalledTimes(2);
    await store.reloadBase();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('preserves the working state after an invalid base reload', async () => {
    let current: unknown = baseJson;
    const store = new ConfigStore({ fetchJson: async () => structuredClone(current) });
    await store.load();
    store.updateOverrides({ player: { moveSpeed: 8 } });
    const previous = store.getConfig();
    const notify = vi.fn();
    store.subscribe(notify);
    current = { ...base, bosses: { basic: { ...base.bosses.basic, hpMultiplier: 0 } } };
    await expect(store.reloadBase()).rejects.toThrow(/hpMultiplier/);
    expect(store.getConfig()).toEqual(previous);
    expect(store.getOverrides()).toEqual({ player: { moveSpeed: 8 } });
    expect(notify).not.toHaveBeenCalled();
  });

  it('stops notifications after unsubscribe and deduplicates a listener', async () => {
    const { store } = storeWithData();
    await store.load();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.subscribe(listener);
    store.updateOverrides({ player: { moveSpeed: 8 } });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.clearOverrides();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
