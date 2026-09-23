import { GameApp } from './app/GameApp';
import { ConfigStore } from './config/ConfigStore';
import type { LevelDefinition } from './level/LevelDefinition';
import { loadLevelDefinition } from './level/LevelLoader';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;

const configStore = new ConfigStore({ storage: window.localStorage });
async function startGame(): Promise<void> {
  let level: LevelDefinition;
  try {
    await configStore.load();
    level = await loadLevelDefinition('/game-data/levels/level-001.json');
  } catch (error) {
    console.error('Failed to load game data', error);
    gameViewport.classList.add('game-viewport-error');
    gameViewport.textContent = 'Failed to load game data. See console for details.';
    return;
  }

  const app = new GameApp(gameViewport, configStore, level);
  app.start();
}

void startGame();
