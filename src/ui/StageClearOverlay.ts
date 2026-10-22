import type { CombatStats } from '../simulation/combatStats';
import { combatResults } from '../simulation/combatStats';
import { publicAssetUrl } from '../core/publicAssetUrl';
import { CreditsOverlay } from './CreditsOverlay';

export function clearResultRows(stats: Readonly<CombatStats>, clearSeconds: number): [string, string][] {
  const s = combatResults(stats, clearSeconds), minutes = Math.floor(s.clearSeconds / 60);
  return [['通關時間', `${minutes}:${(s.clearSeconds % 60).toFixed(1).padStart(4, '0')}`],
    ['擊殺總數', String(s.totalKills)], ['一般兵／重裝兵／巨人兵', `${s.gruntKills} / ${s.heavyKills} / ${s.giantKills}`],
    ['發射子彈', String(s.shotsFired)], ['命中子彈', String(s.shotsHit)], ['命中率', `${(s.accuracy * 100).toFixed(1)}%`],
    ['使用手榴彈', String(s.grenadesUsed)]];
}
export function defeatResultRows(stats: Readonly<CombatStats>, seconds: number): [string, string][] {
  const rows = clearResultRows(stats, seconds);
  return [['存活時間', rows[0][1]], rows[1], rows[5]];
}
export class StageClearOverlay {
  readonly element = document.createElement('div');
  private readonly results = document.createElement('dl');
  private readonly illustration = document.createElement('img');
  private readonly button = document.createElement('button');
  private shown = false;
  private credits: CreditsOverlay | null = null;
  private readonly previewNote = document.createElement('small');
  constructor(private readonly viewport: HTMLElement, private readonly onPlayAgain: () => void,
    private readonly outcome: 'victory' | 'defeat' = 'victory') {
    const defeat = outcome === 'defeat', titleId = defeat ? 'defeat-results-title' : 'stage-clear-title';
    this.element.className = defeat ? 'stage-clear-overlay game-over-overlay defeat-results-overlay' : 'stage-clear-overlay'; this.element.hidden = true;
    this.element.lang = 'zh-Hant';
    this.element.setAttribute('role', 'region'); this.element.setAttribute('aria-labelledby', titleId);
    const title = document.createElement('h1'); title.textContent = defeat ? '作戰失敗' : '第一關通關！';
    title.id = titleId; title.className = 'stage-clear-title';
    this.illustration.className = 'stage-clear-illustration';
    this.illustration.alt = defeat ? '滿身塵土的士兵低頭蹲坐在地上，疲憊的指揮官蹲在身旁，手扶他的肩膀' : '戰區指揮官微笑著將手放在藍盔士兵肩膀上';
    this.illustration.src = publicAssetUrl(`art/${defeat ? 'defeat' : 'victory'}/commander-soldier.webp`);
    this.illustration.decoding = 'async'; this.illustration.draggable = false;
    this.button.type = 'button'; this.button.textContent = defeat ? '再試一次' : '再玩一次';
    this.button.addEventListener('click', onPlayAgain); this.element.addEventListener('pointerdown', this.stopPointer);
    this.element.append(title, this.results, this.illustration, this.button); viewport.append(this.element);
    if (!defeat) {
      this.previewNote.textContent = 'DEV 範例戰績'; this.previewNote.hidden = true;
      this.previewNote.style.cssText = 'position:absolute;left:8%;top:47%;font:11px sans-serif;color:#ffdb78';
      this.element.append(this.previewNote);
    }
  }
  private readonly stopPointer = (event: PointerEvent): void => event.stopPropagation();
  setDevPreview(preview: boolean): void { if (this.previewNote) this.previewNote.hidden = !preview; }
  show(stats: Readonly<CombatStats>, clearSeconds: number): void {
    if (this.shown) return;
    this.shown = true; this.results.replaceChildren();
    if (this.outcome === 'victory') {
      this.credits = new CreditsOverlay(this.viewport, undefined, 'victory');
      this.credits.button.className = 'stage-clear-credits';
      this.element.append(this.credits.button);
    }
    const rows = this.outcome === 'defeat' ? defeatResultRows(stats, clearSeconds) : clearResultRows(stats, clearSeconds);
    for (const [index, [label, value]] of rows.entries()) {
      const row = document.createElement('div'); row.className = 'stage-clear-stat';
      row.dataset.result = String(this.outcome === 'defeat' && index === 2 ? 5 : index);
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; row.append(dt, dd); this.results.append(row);
    }
    this.element.hidden = false;
  }
  reset(): void {
    this.credits?.dispose(); this.credits = null;
    this.shown = false; this.element.hidden = true;
  }
  dispose(): void {
    this.credits?.dispose(); this.credits = null;
    this.button.removeEventListener('click', this.onPlayAgain); this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
  }
}
