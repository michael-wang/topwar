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
import { mountBuildLabel, refreshDevBuildLabel } from './ui/BuildLabel';
import { GameAudio } from './audio/GameAudio';
import { ObserverPortraits } from './ui/ObserverPortraits';
import { FIELD_OBSERVER_LOCALE } from './ui/observerLocale';
import { clearCheckpoint, readCheckpoint, type CheckpointRead } from './app/SessionCheckpoint';
import { SessionRecovery } from './ui/SessionRecovery';
import { startupFailure, startupLoading, startupPaint, startupResource, startupStatus } from './ui/StartupFeedback';

const viewport = document.querySelector<HTMLElement>('#game-viewport');
if (!viewport) {
  throw new Error('Game viewport is missing');
}
const gameViewport = viewport;
const explosionLab = import.meta.env.DEV && new URLSearchParams(location.search).has('explosion-lab');
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
        startupLoading(gameViewport, resume);
        resolve(resume);
      }, true);
    });
  };
  // Strict saved-config/Simulation validation is independent of network and GPU assets.
  if (saved.status === 'valid' || saved.status === 'invalid') offerRecovery(saved.status === 'valid');
  try {
    startupStatus('正在讀取遊戲設定…', 0);
    const data = await startupResource(Promise.all([
      configStore.load(),
      loadLevelDefinition(publicAssetUrl('game-data/levels/level-001.json')),
    ]));
    level = data[1];
    const defense = !!configStore.getConfig().catharsis?.defenseMode;
    if (saved.status === 'valid' && (saved.checkpoint.mode === 'defense') !== defense) {
      saved = { status: 'invalid' };
      if (recovery.selected !== false) offerRecovery(false);
    }
    if (defense) {
      portraits = new ObserverPortraits();
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'missionIntro');
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'destroyer');
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'tankBoss');
      audio.prepareRadio(FIELD_OBSERVER_LOCALE, 'victory');
    }
    startupStatus('正在準備角色與戰場…', 1);
    await startupPaint();
    assets = await startupResource(loadCharacterAssets());
    startupStatus('正在建立戰場…', 2);
  } catch (error) {
    recovery.dialog?.dispose();
    portraits?.dispose(); audio.dispose();
    console.error('Failed to load game assets or data', error);
    startupFailure(gameViewport);
    return;
  }

  const continueGame = recovery.decision ? await recovery.decision : false;
  const chosenRecovery = recovery.dialog ? { dialog: recovery.dialog, continueGame } : undefined;
  let app: GameApp | undefined;
  try {
    await startupPaint();
    app = new GameApp(gameViewport, configStore, level, assets,
      perfEnabled(window.location.search), audio, portraits, saved,
      chosenRecovery);
    startupStatus('正在完成準備…', 3);
    app.start();
    startupStatus(continueGame ? '即將開始' : '準備完成', 4);
    await startupPaint();
    if (saved.status !== 'valid' && saved.status !== 'invalid') SessionRecovery.clearLoading(gameViewport);
    recovery.dialog?.initializationReady();
  } catch (error) {
    recovery.dialog?.dispose();
    if (app) app.dispose(); else { assets.dispose(); portraits?.dispose(); audio.dispose(); }
    console.error('Failed to initialize game', error); startupFailure(gameViewport);
  }
}

if (explosionLab) {
  // The HTML boot cover may indicate a saved DEV session. Dismiss only
  // its loading UI; the isolated lab must never validate, consume or clear that save.
  void import('./dev/ExplosionLab').then(({ mountExplosionLab }) => {
    SessionRecovery.clearLoading(gameViewport); mountExplosionLab(gameViewport);
  }).catch(error => { console.error('Failed to load Explosion Lab', error); startupFailure(gameViewport); });
} else void startGame();
