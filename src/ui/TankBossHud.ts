import type { SimulationFrameState } from '../simulation/SimulationState';

export class TankBossHud {
  readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly bar = document.createElement('div');
  private readonly fill = document.createElement('div');
  constructor(viewport: HTMLElement) {
    this.element.className = 'tank-boss-hud'; this.element.hidden = true;
    this.bar.className = 'tank-boss-bar'; this.fill.className = 'tank-boss-fill';
    this.bar.setAttribute('role', 'progressbar'); this.bar.ariaLabel = 'Tank Boss HP';
    this.bar.append(this.fill); this.element.append(this.label, this.bar); viewport.append(this.element);
  }
  update(state: SimulationFrameState): void {
    const tank = state.defenseTank, config = state.catharsis?.balance.defenseTank;
    this.element.hidden = !tank || !config || tank.status === 'defeated' || tank.status === 'breached';
    if (!tank || !config || this.element.hidden) return;
    const hp = Math.ceil(tank.hp);
    this.label.textContent = `TANK BOSS · ${tank.status === 'entering' ? 'INCOMING' : `PHASE ${tank.phase}`} · ${hp} / ${config.hp}`;
    this.fill.style.transform = `scaleX(${tank.hp / config.hp})`;
    this.bar.setAttribute('aria-valuemin', '0'); this.bar.setAttribute('aria-valuemax', String(config.hp));
    this.bar.setAttribute('aria-valuenow', String(hp)); this.element.dataset.phase = String(tank.phase);
  }
  reset(): void { this.element.hidden = true; }
  dispose(): void { this.element.remove(); }
}
