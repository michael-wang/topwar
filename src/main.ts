import { GameApp } from './app/GameApp';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}

const app = new GameApp(viewport);
app.start();
