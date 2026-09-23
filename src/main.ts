import { GameApp } from './app/GameApp';
import { ConfigStore } from './config/ConfigStore';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;

const configStore = new ConfigStore({ storage: window.localStorage });
async function startGame(): Promise<void> {
  try {
    await configStore.load();
  } catch (error) {
    console.error('Failed to load game configuration', error);
    gameViewport.classList.add('game-viewport-error');
    gameViewport.textContent = 'Failed to load game configuration. See console for details.';
    return;
  }

  const app = new GameApp(gameViewport, configStore);
  app.start();
}

void startGame();
