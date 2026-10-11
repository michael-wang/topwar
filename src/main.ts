import './ui/observer.css';
import { applyArtTheme } from './ui/ArtTheme';
import { GameApp } from './app/GameApp';
import { ConfigStore } from './config/ConfigStore';
import type { LevelDefinition } from './level/LevelDefinition';
import { loadLevelDefinition } from './level/LevelLoader';
import { publicAssetUrl } from './core/publicAssetUrl';
import { loadCharacterAssets } from './rendering/CharacterAssets';
import './style.css';
import './ui/arcade.css';
import { perfEnabled } from './app/PerfDiagnostics';
import { threatReviewEnabled } from './app/ThreatReview';
import { mountBuildLabel, refreshDevBuildLabel } from './ui/BuildLabel';
import { GameAudio } from './audio/GameAudio';
import { ObserverPortraits } from './ui/ObserverPortraits';
import { FIELD_OBSERVER_LOCALE } from './ui/observerLocale';
import { checkpointPresent, readCheckpoint, type CheckpointRead } from './app/SessionCheckpoint';
import { SessionRecovery } from './ui/SessionRecovery';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;
if (checkpointPresent()) SessionRecovery.loading(gameViewport);
applyArtTheme(document.documentElement);
const buildLabel = mountBuildLabel(gameViewport, __TOPWAR_VERSION__, __TOPWAR_SHA__);
if (import.meta.env.DEV) void refreshDevBuildLabel(buildLabel, __TOPWAR_VERSION__, __TOPWAR_SHA__);

const configStore = new ConfigStore();
async function startGame(): Promise<void> {
  let level: LevelDefinition;
  let assets;
  const audio = new GameAudio();
  let portraits: ObserverPortraits | undefined;
  let saved: CheckpointRead = { status: 'empty' };
  try {
    const data = await Promise.all([
      configStore.load(),
      loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json')),
    ]);
    level = data[1];
    saved = readCheckpoint();
    const defense = !!configStore.getConfig().catharsis?.defenseMode;
    if (saved.status === 'valid' && (saved.checkpoint.mode === 'defense') !== defense) saved = { status: 'invalid' };
    if (defense) {
      portraits = new ObserverPortraits();
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'missionIntro');
    }
    assets = await loadCharacterAssets(!defense);
  } catch (error) {
    portraits?.dispose(); audio.dispose();
    console.error('Failed to load game assets or data', error);
    gameViewport.classList.add('game-viewport-error');
    gameViewport.textContent = 'Failed to load game assets or data. See console for details.';
    SessionRecovery.clearLoading(gameViewport);
    return;
  }

  const app = new GameApp(gameViewport, configStore, level, assets,
    perfEnabled(window.location.search), threatReviewEnabled(window.location.search), audio, portraits, saved);
  if (saved.status !== 'valid' && saved.status !== 'invalid') SessionRecovery.clearLoading(gameViewport);
  app.start();
}

void startGame();
