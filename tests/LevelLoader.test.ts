import { afterEach, describe, expect, it, vi } from 'vitest';
import authoredLevel from '../public/game-data/levels/level-001.json';
import { loadLevelDefinition } from '../src/level/LevelLoader';

const url = '/game-data/levels/level-001.json';

afterEach(() => vi.unstubAllGlobals());

describe('loadLevelDefinition', () => {
  it('loads runtime data through an injected fetcher and validates the result', async () => {
    const fetchJson = vi.fn(async () => structuredClone(authoredLevel));
    const loaded = await loadLevelDefinition(url, { fetchJson });
    expect(fetchJson).toHaveBeenCalledWith(url);
    expect(loaded).toEqual(authoredLevel);
  });

  it('rejects invalid fetched data with the requested URL and validation path', async () => {
    await expect(loadLevelDefinition(url, {
      fetchJson: async () => ({ ...authoredLevel, enemyGroups: [{ ...authoredLevel.enemyGroups[0], count: 0 }] }),
    })).rejects.toThrow(/level-001\.json:[\s\S]*enemyGroups[\s\S]*count/);
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
