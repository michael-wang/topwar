import { GameConfigSchema, type GameConfig } from './configSchema';
import type { DeepPartial } from './configTypes';
import { publicAssetUrl } from '../core/publicAssetUrl';

export interface ConfigStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ConfigStoreOptions {
  sourceUrl?: string;
  storage?: ConfigStorage | null;
  storageKey?: string;
  fetchJson?: (url: string) => Promise<unknown>;
}

export type ConfigListener = (config: Readonly<GameConfig>) => void;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value: unknown): asserts value is PlainObject {
  if (!isPlainObject(value)) throw new Error('Config overrides must be a plain object');
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') requirePlainObject(child);
  }
}

function mergeObjects(base: PlainObject, patch: PlainObject): PlainObject {
  const merged = Object.fromEntries(Object.entries(base));
  for (const [key, value] of Object.entries(patch)) {
    const previous = base[key];
    merged[key] = isPlainObject(previous) && isPlainObject(value)
      ? mergeObjects(previous, value)
      : value;
  }
  return merged;
}

async function fetchConfigJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Failed to fetch config from ${url}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Failed to fetch config from ${url}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse config JSON from ${url}`, { cause: error });
  }
}

export class ConfigStore {
  private readonly sourceUrl: string;
  private readonly storage: ConfigStorage | null;
  private readonly storageKey: string;
  private readonly fetchJson: (url: string) => Promise<unknown>;
  private readonly listeners = new Set<ConfigListener>();
  private base: GameConfig | null = null;
  private effective: GameConfig | null = null;
  private overrides: DeepPartial<GameConfig> = {};

  constructor(options: ConfigStoreOptions = {}) {
    this.sourceUrl = options.sourceUrl ?? publicAssetUrl('game-data/game.json');
    this.storage = options.storage ?? null;
    this.storageKey = options.storageKey ?? 'topwar:config-overrides:v1';
    this.fetchJson = options.fetchJson ?? fetchConfigJson;
  }

  async load(): Promise<void> {
    const base = GameConfigSchema.parse(await this.fetchJson(this.sourceUrl));
    let overrides: DeepPartial<GameConfig> = {};
    if (this.storage) {
      try {
        const saved = this.storage.getItem(this.storageKey);
        if (saved !== null) {
          const parsed: unknown = JSON.parse(saved);
          requirePlainObject(parsed);
          this.validateEffective(base, parsed as DeepPartial<GameConfig>);
          overrides = parsed as DeepPartial<GameConfig>;
        }
      } catch (error) {
        console.warn(`Discarding invalid persisted config overrides at ${this.storageKey}`, error);
        try {
          this.storage.removeItem(this.storageKey);
        } catch (removeError) {
          console.warn(`Could not remove invalid config overrides at ${this.storageKey}`, removeError);
        }
      }
    }

    const effective = this.validateEffective(base, overrides);
    this.base = base;
    this.overrides = structuredClone(overrides);
    this.effective = effective;
  }

  async reloadBase(): Promise<void> {
    this.requireLoaded();
    const base = GameConfigSchema.parse(await this.fetchJson(this.sourceUrl));
    const effective = this.validateEffective(base, this.overrides);
    const changed = JSON.stringify(effective) !== JSON.stringify(this.effective);
    this.base = base;
    this.effective = effective;
    if (changed) this.notify();
  }

  getConfig(): Readonly<GameConfig> {
    this.requireLoaded();
    return structuredClone(this.effective!);
  }

  getOverrides(): DeepPartial<GameConfig> {
    return structuredClone(this.overrides);
  }

  updateOverrides(patch: DeepPartial<GameConfig>): void {
    this.requireLoaded();
    requirePlainObject(patch);
    this.commitOverrides(mergeObjects(this.overrides, patch) as DeepPartial<GameConfig>);
  }

  replaceOverrides(overrides: DeepPartial<GameConfig>): void {
    this.requireLoaded();
    requirePlainObject(overrides);
    this.commitOverrides(overrides);
  }

  clearOverrides(): void {
    this.requireLoaded();
    const changed = JSON.stringify(this.effective) !== JSON.stringify(this.base);
    this.storage?.removeItem(this.storageKey);
    this.overrides = {};
    this.effective = this.base!;
    if (changed) this.notify();
  }

  subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commitOverrides(overrides: DeepPartial<GameConfig>): void {
    const effective = this.validateEffective(this.base!, overrides);
    const changed = JSON.stringify(effective) !== JSON.stringify(this.effective);
    const ownedOverrides = structuredClone(overrides);
    this.storage?.setItem(this.storageKey, JSON.stringify(ownedOverrides));
    this.overrides = ownedOverrides;
    this.effective = effective;
    if (changed) this.notify();
  }

  private validateEffective(base: GameConfig, overrides: DeepPartial<GameConfig>): GameConfig {
    return GameConfigSchema.parse(mergeObjects(base, overrides));
  }

  private requireLoaded(): void {
    if (!this.base || !this.effective) throw new Error('ConfigStore.load() must succeed first');
  }

  private notify(): void {
    const config = this.getConfig();
    for (const listener of this.listeners) listener(structuredClone(config));
  }
}
