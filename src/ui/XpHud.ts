import { xpEdgeColor } from './xpPalette';
import type { ProgressionState, ProgressionBalance } from '../simulation/progression';
import { requiredXp } from '../simulation/progression';
import { LEVEL_UP_MS, LEVEL_BAR_FLASH_MS, type ProgressionLevelUpEvent } from '../presentation/ProgressionLevelUp';

export class XpHud {
  private readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly fill = document.createElement('div');
  private readonly edge = document.createElement('div');
  private readonly message = document.createElement('div');
  private readonly detail = document.createElement('span');
  private event: ProgressionLevelUpEvent | null = null;
  private startedAtMs = -Infinity;
  private wasFlashing = false;
  private previousProgress: ProgressionState | null = null;
  private gainUntilMs = -Infinity;
  constructor(viewport: HTMLElement) {
    this.element.className = 'xp-hud';
    this.element.style.pointerEvents = 'none';
    this.label.className = 'xp-level';
    const track = document.createElement('div');
    track.className = 'xp-track';
    this.fill.className = 'xp-fill';
    this.edge.className = 'xp-edge';
    this.message.className = 'level-up-message';
    const title = document.createElement('strong');
    title.textContent = 'LEVEL UP';
    const detail = this.detail;
    detail.className = 'level-up-detail';
    detail.textContent = 'FIRE RATE ↑';
    this.message.append(title, detail);
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
    const progress = state.xp / requirement;
    if (this.previousProgress?.level === state.level && state.xp - this.previousProgress.xp >= requirement * .2)
      this.gainUntilMs = nowMs + 260;
    this.previousProgress = { ...state };
    const gainMs = nowMs < this.gainUntilMs ? 260 : 120;
    const reinforcement = active && this.event!.fromLevel < balance.reinforcementLevel && this.event!.toLevel >= balance.reinforcementLevel;
    this.detail.textContent = reinforcement ? '' : 'FIRE RATE ↑';
    this.label.textContent = `LV ${active && age < 120 ? this.event!.fromLevel : state.level}`;
    this.element.classList.toggle('level-up', active);
    this.element.classList.toggle('level-flash', flashing);
    this.element.classList.toggle('level-label-pop', active && age >= 120 && age < 500);
    this.element.classList.toggle('xp-charged', !active && progress >= .7);
    this.element.classList.toggle('xp-imminent', !active && progress >= .9);
    // Reset instantly after the full flash; interpolate only forward XP acquisition.
    this.fill.style.transition = flashing || this.wasFlashing ? 'none' : `clip-path ${gainMs}ms ease-out`;
    const revealed = flashing ? 1 : progress;
    this.fill.style.clipPath = `inset(0 ${(1 - revealed) * 100}% 0 0 round .45rem)`;
    this.edge.style.transition = flashing || this.wasFlashing ? 'none' : `left ${gainMs}ms ease-out`;
    this.edge.style.left = `${revealed * 100}%`;
    this.edge.style.visibility = revealed > 0 ? 'visible' : 'hidden';
    this.edge.style.color = xpEdgeColor(revealed);
    this.wasFlashing = flashing;
  }
  reset(): void {
    this.event = null; this.startedAtMs = -Infinity; this.wasFlashing = false;
    this.previousProgress = null; this.gainUntilMs = -Infinity;
    for (const name of ['level-up', 'level-flash', 'level-label-pop', 'xp-charged', 'xp-imminent']) this.element.classList.remove(name);
    this.fill.style.transition = 'none'; this.fill.style.clipPath = 'inset(0 100% 0 0 round .45rem)'; this.edge.style.visibility = 'hidden'; this.label.textContent = 'LV 1';
  }
  dispose(): void { this.element.remove(); }
}
