import type { CombatStats } from '../simulation/combatStats';
import { combatResults } from '../simulation/combatStats';
import { publicAssetUrl } from '../core/publicAssetUrl';

export function clearResultRows(stats: Readonly<CombatStats>, clearSeconds: number): [string, string][] {
  const s = combatResults(stats, clearSeconds), minutes = Math.floor(s.clearSeconds / 60);
  return [['通關時間', `${minutes}:${(s.clearSeconds % 60).toFixed(1).padStart(4, '0')}`],
    ['擊殺總數', String(s.totalKills)], ['一般兵／重裝兵／巨人兵', `${s.gruntKills} / ${s.heavyKills} / ${s.giantKills}`],
    ['發射子彈', String(s.shotsFired)], ['命中子彈', String(s.shotsHit)], ['命中率', `${(s.accuracy * 100).toFixed(1)}%`],
    ['使用手榴彈', String(s.grenadesUsed)]];
}
export class StageClearOverlay {
  readonly element = document.createElement('div');
  private readonly results = document.createElement('dl');
  private readonly illustration = document.createElement('img');
  private readonly button = document.createElement('button');
  private shown = false;
  constructor(viewport: HTMLElement, private readonly onPlayAgain: () => void) {
    this.element.className = 'stage-clear-overlay'; this.element.hidden = true;
    this.element.lang = 'zh-Hant';
    this.element.setAttribute('role', 'region'); this.element.setAttribute('aria-labelledby', 'stage-clear-title');
    const title = document.createElement('h1'); title.textContent = '第一關通關！';
    title.id = 'stage-clear-title'; title.className = 'stage-clear-title';
    this.illustration.className = 'stage-clear-illustration';
    this.illustration.alt = '海防指揮官微笑著將手放在藍盔士兵肩膀上';
    this.illustration.src = publicAssetUrl('art/victory/commander-soldier.webp');
    this.illustration.decoding = 'async'; this.illustration.draggable = false;
    this.button.type = 'button'; this.button.textContent = '再玩一次';
    this.button.addEventListener('click', onPlayAgain); this.element.addEventListener('pointerdown', this.stopPointer);
    this.element.append(title, this.results, this.illustration, this.button); viewport.append(this.element);
  }
  private readonly stopPointer = (event: PointerEvent): void => event.stopPropagation();
  show(stats: Readonly<CombatStats>, clearSeconds: number): void {
    if (this.shown) return;
    this.shown = true; this.results.replaceChildren();
    for (const [index, [label, value]] of clearResultRows(stats, clearSeconds).entries()) {
      const row = document.createElement('div'); row.className = 'stage-clear-stat';
      row.dataset.result = String(index);
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; row.append(dt, dd); this.results.append(row);
    }
    this.element.hidden = false;
  }
  reset(): void { this.shown = false; this.element.hidden = true; }
  dispose(): void {
    this.button.removeEventListener('click', this.onPlayAgain); this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
