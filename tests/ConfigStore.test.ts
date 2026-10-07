import { afterEach, describe, expect, it, vi } from 'vitest';
import data from '../public/game-data/game.json';
import { ConfigStore, type ConfigStorage } from '../src/config/ConfigStore';
import { GameConfigSchema } from '../src/config/configSchema';

const base = GameConfigSchema.parse(data);
function memoryStorage(): ConfigStorage & { data: Map<string, string> } {
  const values = new Map<string, string>();
  return { data: values, getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); } };
}
const store = (storage?: ConfigStorage, source: unknown = data) => new ConfigStore({ storage,
  fetchJson: async () => structuredClone(source) });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('runtime config with generic tiers', () => {
  it('loads and reloads production config from the versioned Pages path without cache reuse', async () => {
    vi.stubEnv('PROD', true); vi.stubEnv('BASE_URL', '/topwar/');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(data)));
    vi.stubGlobal('fetch', fetchMock);
    const config = new ConfigStore();
    await config.load(); await config.reloadBase();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, `/topwar/game-data/game.json?v=${__TOPWAR_SHA__}`, { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/topwar/game-data/game.json?v=${__TOPWAR_SHA__}`, { cache: 'no-store' });
    expect(config.getConfig()).toEqual(base);
  });

  it('keeps the default development config request unversioned', async () => {
    vi.stubEnv('PROD', false); vi.stubEnv('BASE_URL', '/');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(data)));
    vi.stubGlobal('fetch', fetchMock);
    await new ConfigStore().load();
    expect(fetchMock).toHaveBeenCalledWith('/game-data/game.json');
  });

  it('loads authored power and rifle cadence from runtime JSON', async () => {
    const config = store();
    expect(() => config.getConfig()).toThrow(/load/);
    await config.load();
    expect(config.getConfig()).toEqual(base);
    expect(config.getConfig().tiers).toEqual({ mergeCount: 10, tier1Power: 3,
      tier2Power: 300, enemyHigherTierPowerMultiplier: 10, rifleHigherTierPowerMultiplier: 10, normalEnemyRadius: 0.3 });
    expect(config.getConfig().weapon.rifle).toEqual({ fireRate: 3, projectileSpeed: 60,
      range: 80, tierHitRadiusStep: 0.45, maxHitRadiusBonus: 0.90 });
  });

  it('rejects obsolete enemy HP and fixed rifle damage fields', () => {
    expect(() => GameConfigSchema.parse({ ...base, enemies: { grunt: { hp: 3 } } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, weapon: { ...base.weapon,
      rifle: { ...base.weapon.rifle, damage: 3 } } })).toThrow();
    expect(() => GameConfigSchema.parse({ ...base, bosses: { basic: { ...base.bosses.basic,
      hpMultiplier: 5000 } } })).toThrow();
  });

  it('accepts live tier-power overrides and notifies subscribers once', async () => {
    const config = store();
    await config.load();
    const listener = vi.fn();
    config.subscribe(listener);
    config.updateOverrides({ tiers: { tier1Power: 6 } });
    expect(config.getConfig().tiers.tier1Power).toBe(6);
    expect(config.getOverrides()).toEqual({ tiers: { tier1Power: 6 } });
    expect(listener).toHaveBeenCalledOnce();
    config.updateOverrides({ tiers: { tier1Power: 6 } });
    expect(listener).toHaveBeenCalledOnce();
    config.clearOverrides();
    expect(config.getConfig()).toEqual(base);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid overrides atomically', async () => {
    const config = store();
    await config.load();
    expect(() => config.updateOverrides({ tiers: { mergeCount: 1 } })).toThrow();
    expect(() => config.updateOverrides({ tiers: { normalEnemyRadius: -1 } })).toThrow();
    expect(config.getOverrides()).toEqual({});
    expect(config.getConfig()).toEqual(base);
  });

  it('persists and reloads generic tier overrides', async () => {
    const storage = memoryStorage();
    const first = store(storage);
    await first.load();
    first.updateOverrides({ tiers: { tier2Power: 600 } });
    const second = store(storage);
    await second.load();
    expect(second.getConfig().tiers.tier2Power).toBe(600);
    expect(second.getOverrides()).toEqual({ tiers: { tier2Power: 600 } });
  });

  it('discards malformed persisted overrides safely', async () => {
    const storage = memoryStorage();
    storage.setItem('topwar:config-overrides:v1', JSON.stringify({ tiers: { mergeCount: 0 } }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = store(storage);
    await config.load();
    expect(config.getConfig()).toEqual(base);
    expect(storage.getItem('topwar:config-overrides:v1')).toBeNull();
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });
});
