import type { CombatStats } from '../simulation/combatStats';
import { combatResults } from '../simulation/combatStats';

export function clearResultRows(stats: Readonly<CombatStats>, clearSeconds: number): [string, string][] {
  const s = combatResults(stats, clearSeconds), minutes = Math.floor(s.clearSeconds / 60);
  return [['Clear Time', `${minutes}:${(s.clearSeconds % 60).toFixed(1).padStart(4, '0')}`],
    ['Total Enemies Defeated', String(s.totalKills)], ['Grunt / Heavy / Giant Kills', `${s.gruntKills} / ${s.heavyKills} / ${s.giantKills}`],
    ['Shots Fired', String(s.shotsFired)], ['Shots Hit', String(s.shotsHit)], ['Accuracy', `${(s.accuracy * 100).toFixed(1)}%`],
    ['Grenades Used', String(s.grenadesUsed)]];
}
export class StageClearOverlay {
  readonly element = document.createElement('div');
  private readonly results = document.createElement('dl');
  private readonly button = document.createElement('button');
  private shown = false;
  constructor(viewport: HTMLElement, private readonly onPlayAgain: () => void) {
    this.element.className = 'stage-clear-overlay'; this.element.hidden = true;
    const title = document.createElement('h1'); title.textContent = 'STAGE 1 CLEAR';
    this.button.type = 'button'; this.button.textContent = 'PLAY AGAIN';
    this.button.addEventListener('click', onPlayAgain); this.button.addEventListener('pointerdown', this.stopPointer);
    this.element.append(title, this.results, this.button); viewport.append(this.element);
  }
  private readonly stopPointer = (event: PointerEvent): void => event.stopPropagation();
  show(stats: Readonly<CombatStats>, clearSeconds: number): void {
    if (this.shown) return;
    this.shown = true; this.results.replaceChildren();
    for (const [label, value] of clearResultRows(stats, clearSeconds)) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; this.results.append(dt, dd);
    }
    this.element.hidden = false;
  }
  reset(): void { this.shown = false; this.element.hidden = true; }
  dispose(): void {
    this.button.removeEventListener('click', this.onPlayAgain); this.button.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
