import type { ProgressionState, ProgressionBalance } from '../simulation/progression';
import { requiredXp } from '../simulation/progression';
export class XpHud {
  private readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly fill = document.createElement('div');
  private readonly message = document.createElement('div');
  private previousLevel = 1;
  private pulseUntilMs = -Infinity;
  constructor(viewport: HTMLElement) {
    this.element.className = 'xp-hud';
    const track = document.createElement('div');
    track.className = 'xp-track';
    this.fill.className = 'xp-fill';
    this.message.className = 'level-up-message';
    track.append(this.fill);
    this.element.append(this.label, track, this.message);
    viewport.append(this.element);
  }
  update(state: Readonly<ProgressionState>, balance: ProgressionBalance, nowMs: number): boolean {
    const gained = state.level > this.previousLevel;
    if (state.level < this.previousLevel) this.pulseUntilMs = -Infinity;
    if (gained) {
      this.pulseUntilMs = nowMs + 800;
      this.message.textContent = `LEVEL UP · FIRE RATE +${(state.level - this.previousLevel) * balance.fireRatePerLevel}`;
    }
    this.previousLevel = state.level;
    const required = requiredXp(state.level, balance);
    this.label.textContent = `LV ${state.level}   ${state.xp} / ${required}`;
    this.fill.style.width = `${state.xp / required * 100}%`;
    this.element.classList.toggle('level-up', nowMs < this.pulseUntilMs);
    return gained;
  }
  reset(): void { this.previousLevel = 1; this.pulseUntilMs = -Infinity; this.element.classList.remove('level-up'); }
  dispose(): void { this.element.remove(); }
}
