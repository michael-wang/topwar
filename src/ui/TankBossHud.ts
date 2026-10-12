import type { SimulationFrameState } from '../simulation/SimulationState';
import type { GrenadeEvent } from '../simulation/grenade';

export class TankBossHud {
  readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly bar = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly damage = document.createElement('span');
  private damageUntilMs = -Infinity;
  constructor(viewport: HTMLElement) {
    this.element.className = 'tank-boss-hud'; this.element.hidden = true;
    this.bar.className = 'tank-boss-bar'; this.fill.className = 'tank-boss-fill';
    this.damage.className = 'tank-boss-damage'; this.damage.hidden = true;
    this.bar.setAttribute('role', 'progressbar'); this.bar.ariaLabel = 'Tank Boss HP';
    this.label.className = 'tank-boss-hp';
    this.bar.append(this.fill, this.label); this.element.append(this.bar, this.damage); viewport.append(this.element);
  }
  presentGrenade(events: readonly GrenadeEvent[], nowMs: number): void {
    for (const event of events) if (event.kind === 'grenadeDetonated' && (event.tankDamage ?? 0) > 0) {
      this.damage.textContent = `GRENADE −${event.tankDamage} HP`;
      this.damageUntilMs = nowMs + 750; this.damage.hidden = false;
    }
  }
  update(state: SimulationFrameState, nowMs: number, position: { x: number; y: number } | null): void {
    const tank = state.defenseTank, config = state.catharsis?.balance.defenseTank;
    this.element.hidden = !tank || !config || tank.status !== 'active' || !position;
    this.damage.hidden = this.element.hidden || nowMs >= this.damageUntilMs;
    if (!tank || !config || this.element.hidden) return;
    const hp = Math.ceil(tank.hp);
    this.label.textContent = `${hp} / ${config.hp}`;
    this.element.style.left = `${position!.x}px`; this.element.style.top = `${position!.y - 8}px`;
    this.fill.style.transform = `scaleX(${tank.hp / config.hp})`;
    this.bar.setAttribute('aria-valuemin', '0'); this.bar.setAttribute('aria-valuemax', String(config.hp));
    this.bar.setAttribute('aria-valuenow', String(hp)); this.element.dataset.phase = String(tank.phase);
  }
  reset(): void { this.element.hidden = this.damage.hidden = true; this.damageUntilMs = -Infinity; }
  dispose(): void { this.element.remove(); }
}
