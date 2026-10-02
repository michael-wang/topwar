import type { ProgressionState, ProgressionBalance } from '../simulation/progression';
import { requiredXp } from '../simulation/progression';
import { LEVEL_UP_MS, LEVEL_BAR_FLASH_MS, type ProgressionLevelUpEvent } from '../presentation/ProgressionLevelUp';

export class XpHud {
  private readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly fill = document.createElement('div');
  private readonly message = document.createElement('div');
  private event: ProgressionLevelUpEvent | null = null;
  private startedAtMs = -Infinity;
  private wasFlashing = false;
  constructor(viewport: HTMLElement) {
    this.element.className = 'xp-hud';
    this.label.className = 'xp-level';
    const track = document.createElement('div');
    track.className = 'xp-track';
    this.fill.className = 'xp-fill';
    this.message.className = 'level-up-message';
    const title = document.createElement('strong');
    title.textContent = 'LEVEL UP';
    const detail = document.createElement('span');
    detail.textContent = 'FIRE RATE ↑';
    this.message.append(title, detail);
    track.append(this.fill);
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
    const progress = state.xp / requiredXp(state.level, balance);
    this.label.textContent = `LV ${active && age < 120 ? this.event!.fromLevel : state.level}`;
    this.element.classList.toggle('level-up', active);
    this.element.classList.toggle('level-flash', flashing);
    this.element.classList.toggle('level-label-pop', active && age >= 120 && age < 500);
    this.element.classList.toggle('xp-charged', !active && progress >= .7);
    this.element.classList.toggle('xp-imminent', !active && progress >= .9);
    // Reset instantly after the full flash; interpolate only forward XP acquisition.
    this.fill.style.transition = flashing || this.wasFlashing ? 'none' : 'width 120ms ease-out';
    this.fill.style.width = `${flashing ? 100 : progress * 100}%`;
    this.wasFlashing = flashing;
  }
  reset(): void {
    this.event = null; this.startedAtMs = -Infinity; this.wasFlashing = false;
    for (const name of ['level-up', 'level-flash', 'level-label-pop', 'xp-charged', 'xp-imminent']) this.element.classList.remove(name);
    this.fill.style.transition = 'none'; this.fill.style.width = '0%'; this.label.textContent = 'LV 1';
  }
  dispose(): void { this.element.remove(); }
}
