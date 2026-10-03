import { applyArtTheme } from './ui/ArtTheme';
import { GameApp } from './app/GameApp';
import { ConfigStore } from './config/ConfigStore';
import type { LevelDefinition } from './level/LevelDefinition';
import { loadLevelDefinition } from './level/LevelLoader';
import { publicAssetUrl } from './core/publicAssetUrl';
import { loadCharacterAssets } from './rendering/CharacterAssets';
import './style.css';
import { perfEnabled } from './app/PerfDiagnostics';
import { mountBuildLabel, refreshDevBuildLabel } from './ui/BuildLabel';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;
applyArtTheme(document.documentElement);
const buildLabel = mountBuildLabel(gameViewport, __TOPWAR_VERSION__, __TOPWAR_SHA__);
if (import.meta.env.DEV) void refreshDevBuildLabel(buildLabel, __TOPWAR_VERSION__, __TOPWAR_SHA__);

const configStore = new ConfigStore();
async function startGame(): Promise<void> {
  let level: LevelDefinition;
  let assets;
  try {
    await configStore.load();
    level = await loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json'));
    assets = await loadCharacterAssets();
  } catch (error) {
    console.error('Failed to load game assets or data', error);
    gameViewport.classList.add('game-viewport-error');
    gameViewport.textContent = 'Failed to load game assets or data. See console for details.';
    return;
  }

  const app = new GameApp(gameViewport, configStore, level, assets,
    perfEnabled(window.location.search));
  app.start();
}

void startGame();
