import { GameApp } from './app/GameApp';
import { ConfigStore } from './config/ConfigStore';
import type { LevelDefinition } from './level/LevelDefinition';
import { loadLevelDefinition } from './level/LevelLoader';
import { publicAssetUrl } from './core/publicAssetUrl';
import { loadCharacterAssets } from './rendering/CharacterAssets';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;

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

  const app = new GameApp(gameViewport, configStore, level, assets);
  app.start();
}

void startGame();
