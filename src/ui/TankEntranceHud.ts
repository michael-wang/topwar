import type { SimulationFrameState } from '../simulation/SimulationState';

// Simulation time freezes both the edge pulses and the small alarm cadence.
export class TankEntranceHud {
  readonly element = document.createElement('div');
  private start: number | null = null;
  private lastPulse = -1;
  private silent = false;
  constructor(host: HTMLElement, private readonly alarm: () => void) {
    this.element.className = 'tank-entrance-warning'; this.element.hidden = true;
    const text = document.createElement('span'); text.textContent = 'BOSS INCOMING';
    this.element.append(text); host.append(this.element);
  }
  update(state: SimulationFrameState, paused: boolean): void {
    const tank = state.defenseTank;
    if (tank && tank.startedAtSeconds !== this.start) {
      this.start = tank.startedAtSeconds; this.lastPulse = -1; this.silent = false;
    }
    const age = tank ? state.elapsedSeconds - tank.startedAtSeconds : 0;
    const visible = !!tank && tank.status === 'entering' && state.squad.count > 0;
    this.element.hidden = !visible;
    if (!visible) return;
    this.element.style.opacity = String(.4 + .6 * Math.cos(age * Math.PI * 3) ** 2);
    const pulse = Math.floor((age + 1e-9) / .75);
    if (!paused && !this.silent && pulse > this.lastPulse) { this.alarm(); this.lastPulse = pulse; }
  }
  restore(state: SimulationFrameState): void {
    this.reset(); this.start = state.defenseTank?.startedAtSeconds ?? null;
    this.silent = !!state.defenseTank; // Remaining visuals may show; awarded alarm sounds never replay.
  }
  reset(): void { this.start = null; this.lastPulse = -1; this.silent = false; this.element.hidden = true; }
  dispose(): void { this.element.remove(); }
}
