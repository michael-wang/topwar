import { afterEach, describe, expect, it, vi } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { loadLevelDefinition } from '../src/level/LevelLoader';
import { publicAssetUrl } from '../src/core/publicAssetUrl';

const url = '/game-data/levels/level-001.json';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('loadLevelDefinition', () => {
  it('loads production level JSON through the versioned public URL without cache reuse', async () => {
    vi.stubEnv('PROD', true); vi.stubEnv('BASE_URL', '/topwar/');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(authoredLevel)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json'))).toEqual(authoredLevel);
    expect(fetchMock).toHaveBeenCalledWith(`/topwar/game-data/levels/level-001.json?v=${__TOPWAR_SHA__}`, { cache: 'no-store' });
  });

  it('keeps development level loading valid without production cache options', async () => {
    vi.stubEnv('PROD', false); vi.stubEnv('BASE_URL', '/');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(authoredLevel)));
    vi.stubGlobal('fetch', fetchMock);
    await loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json'));
    expect(fetchMock).toHaveBeenCalledWith(url);
  });

  it('loads runtime data through an injected fetcher and validates the result', async () => {
    const fetchJson = vi.fn(async () => structuredClone(authoredLevel));
    const loaded = await loadLevelDefinition(url, { fetchJson });
    expect(fetchJson).toHaveBeenCalledWith(url);
    expect(loaded).toEqual(authoredLevel);
  });

  it('rejects invalid fetched data with the requested URL and validation path', async () => {
    await expect(loadLevelDefinition(url, {
      fetchJson: async () => ({ ...authoredLevel, enemyStream: { ...authoredLevel.enemyStream, columns: 0 } }),
    })).rejects.toThrow(/level-001\.json:[\s\S]*enemyStream[\s\S]*columns/);
  });

  it('reports the URL for failed HTTP, malformed JSON, and network failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('{', { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadLevelDefinition(url)).rejects.toThrow(/level-001\.json.*HTTP 404/);
    await expect(loadLevelDefinition(url)).rejects.toThrow(/level-001\.json/);
    await expect(loadLevelDefinition(url)).rejects.toThrow(/level-001\.json.*offline/);
    expect(fetchMock).toHaveBeenCalledWith(url);
  });
});
