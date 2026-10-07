import { xpEdgeColor } from './xpPalette';
import type { ProgressionState, ProgressionBalance } from '../simulation/progression';
import { requiredXp, maxProgressionLevel } from '../simulation/progression';
import { LEVEL_UP_MS, LEVEL_BAR_FLASH_MS, type ProgressionLevelUpEvent } from '../presentation/ProgressionLevelUp';

export class XpHud {
  private readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly levelNumber = document.createElement('strong');
  private readonly fill = document.createElement('div');
  private readonly edge = document.createElement('div');
  private readonly message = document.createElement('div');
  private event: ProgressionLevelUpEvent | null = null;
  private startedAtMs = -Infinity;
  private wasFlashing = false;
  private previousProgress: ProgressionState | null = null;
  private gainUntilMs = -Infinity;
  constructor(viewport: HTMLElement) {
    this.element.className = 'xp-hud';
    this.element.style.pointerEvents = 'none';
    this.label.className = 'xp-level';
    const prefix = document.createElement('span');
    prefix.className = 'xp-level-prefix'; prefix.textContent = 'LV';
    this.levelNumber.className = 'xp-level-number'; this.levelNumber.textContent = '1';
    this.label.append(prefix, this.levelNumber);
    const track = document.createElement('div');
    track.className = 'xp-track';
    this.fill.className = 'xp-fill';
    this.edge.className = 'xp-edge';
    this.message.className = 'level-up-message';
    const title = document.createElement('strong');
    title.textContent = 'LEVEL UP';
    this.message.append(title);
    track.append(this.fill, this.edge);
    this.element.append(this.label, track, this.message);
    viewport.append(this.element);
  }
  presentLevelUp(event: ProgressionLevelUpEvent, nowMs: number): void {
    this.event = event;
    this.startedAtMs = nowMs;
  }
  update(state: Readonly<ProgressionState>, balance: ProgressionBalance, nowMs: number): void {
    const age = nowMs - this.startedAtMs;
    const active = this.event !== null && age >= 0 && age < LEVEL_UP_MS;
    const flashing = active && age < LEVEL_BAR_FLASH_MS;
    const requirement = requiredXp(state.level, balance);
    const complete = state.level >= maxProgressionLevel(balance);
    const progress = complete ? 1 : state.xp / requirement;
    const firstUpdate = this.previousProgress === null;
    if (this.previousProgress?.level === state.level && state.xp - this.previousProgress.xp >= requirement * .2)
      this.gainUntilMs = nowMs + 260;
    this.previousProgress = { ...state };
    const gainMs = nowMs < this.gainUntilMs ? 260 : 120;
    this.levelNumber.textContent = String(active && age < 120 ? this.event!.fromLevel : state.level);
    this.element.classList.toggle('level-up', active);
    this.element.classList.toggle('level-flash', flashing);
    this.element.classList.toggle('level-label-pop', active && age >= 120 && age < 500);
    this.element.classList.toggle('xp-charged', !complete && !active && progress >= .7);
    this.element.classList.toggle('xp-imminent', !complete && !active && progress >= .9);
    this.element.classList.toggle('xp-complete', complete);
    // Reset instantly after the full flash; interpolate only forward XP acquisition.
    this.fill.style.transition = firstUpdate || flashing || this.wasFlashing ? 'none' : `clip-path ${gainMs}ms ease-out`;
    const revealed = flashing ? 1 : progress;
    this.fill.style.clipPath = `inset(0 ${(1 - revealed) * 100}% 0 0 round .45rem)`;
    this.edge.style.transition = firstUpdate || flashing || this.wasFlashing ? 'none' : `left ${gainMs}ms ease-out`;
    this.edge.style.left = `${revealed * 100}%`;
    this.edge.style.visibility = revealed > 0 && !complete ? 'visible' : 'hidden';
    this.edge.style.color = xpEdgeColor(revealed);
    this.wasFlashing = flashing;
  }
  reset(): void {
    this.event = null; this.startedAtMs = -Infinity; this.wasFlashing = false;
    this.previousProgress = null; this.gainUntilMs = -Infinity;
    for (const name of ['level-up', 'level-flash', 'level-label-pop', 'xp-charged', 'xp-imminent', 'xp-complete']) this.element.classList.remove(name);
    this.fill.style.transition = 'none'; this.fill.style.clipPath = 'inset(0 100% 0 0 round .45rem)'; this.edge.style.visibility = 'hidden'; this.levelNumber.textContent = '1';
  }
  dispose(): void { this.element.remove(); }
}
