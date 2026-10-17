import type { CombatStats } from '../simulation/combatStats';
import { emptyCombatStats } from '../simulation/combatStats';
import { StageClearOverlay } from './StageClearOverlay';

/** The same results poster and Retry lifecycle as victory, with a quieter defeat treatment. */
export class GameOverOverlay {
  private readonly poster: StageClearOverlay;
  private readonly historicalStats = emptyCombatStats();
  constructor(viewport: HTMLElement, onRetry: () => void) {
    this.poster = new StageClearOverlay(viewport, onRetry, 'defeat');
  }
  get visible(): boolean { return !this.poster.element.hidden; }
  setVisible(visible: boolean, stats?: Readonly<CombatStats>, seconds = 0): void {
    if (visible) this.poster.show(stats ?? this.historicalStats, seconds);
    else if (!visible && this.visible) this.poster.reset();
  }
  dispose(): void { this.poster.dispose(); }
}
