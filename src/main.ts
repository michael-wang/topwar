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
import { clearCheckpoint, checkpointPresent, readCheckpoint, type CheckpointRead } from './app/SessionCheckpoint';
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
  let saved: CheckpointRead = readCheckpoint();
  const recovery: { dialog: SessionRecovery | null; decision: Promise<boolean> | null; selected?: boolean }
    = { dialog: null, decision: null };
  const offerRecovery = (valid: boolean): void => {
    recovery.dialog?.dispose();
    recovery.decision = new Promise(resolve => {
      recovery.dialog = new SessionRecovery(gameViewport, valid, resume => {
        recovery.selected = resume;
        if (!resume) clearCheckpoint(); // Deliberate invalidation at the actual New Game gesture.
        resolve(resume);
      }, true);
    });
  };
  // Strict saved-config/Simulation validation is independent of network and GPU assets.
  if (saved.status === 'valid' || saved.status === 'invalid') offerRecovery(saved.status === 'valid');
  try {
    const data = await Promise.all([
      configStore.load(),
      loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json')),
    ]);
    level = data[1];
    const defense = !!configStore.getConfig().catharsis?.defenseMode;
    if (saved.status === 'valid' && (saved.checkpoint.mode === 'defense') !== defense) {
      saved = { status: 'invalid' };
      if (recovery.selected !== false) offerRecovery(false);
    }
    if (defense) {
      portraits = new ObserverPortraits();
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'missionIntro');
    }
    assets = await loadCharacterAssets(!defense);
  } catch (error) {
    recovery.dialog?.dispose();
    portraits?.dispose(); audio.dispose();
    console.error('Failed to load game assets or data', error);
    gameViewport.classList.add('game-viewport-error');
    gameViewport.textContent = 'Failed to load game assets or data. See console for details.';
    SessionRecovery.clearLoading(gameViewport);
    return;
  }

  const continueGame = recovery.decision ? await recovery.decision : false;
  const chosenRecovery = recovery.dialog ? { dialog: recovery.dialog, continueGame } : undefined;
  const app = new GameApp(gameViewport, configStore, level, assets,
    perfEnabled(window.location.search), threatReviewEnabled(window.location.search), audio, portraits, saved,
    chosenRecovery);
  if (saved.status !== 'valid' && saved.status !== 'invalid') SessionRecovery.clearLoading(gameViewport);
  app.start();
  recovery.dialog?.initializationReady();
}

void startGame();
