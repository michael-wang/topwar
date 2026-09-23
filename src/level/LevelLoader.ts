import { LevelDefinitionSchema, type LevelDefinition } from './LevelDefinition';

export interface LevelLoaderOptions {
  fetchJson?: (url: string) => Promise<unknown>;
}

async function fetchLevelJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadLevelDefinition(
  url: string,
  options: LevelLoaderOptions = {},
): Promise<LevelDefinition> {
  let data: unknown;
  try {
    data = await (options.fetchJson ?? fetchLevelJson)(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load level ${url}: ${reason}`, { cause: error });
  }

  const parsed = LevelDefinitionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid level definition at ${url}: ${parsed.error.message}`, { cause: parsed.error });
  }
  return parsed.data;
}
