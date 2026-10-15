import type { SimulationFrameState } from '../simulation/SimulationState';

// Created only by local DEV. Placement is provisional pending phone review.
export class ManualAirSupportButton {
  readonly element = document.createElement('button');
  private readonly stopPointer = (event: Event): void => event.stopPropagation();
  private readonly click = (): void => {
    if (!this.element.disabled && this.activate()) this.element.disabled = true;
  };
  constructor(host: HTMLElement, private readonly activate: () => boolean) {
    this.element.type = 'button'; this.element.className = 'manual-air-support';
    this.element.setAttribute('aria-label', '呼叫空襲'); this.element.title = '呼叫空襲（一次）';
    this.element.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M14 3h4l1 10 11 7v3l-11-4-1 8 4 2v2l-6-2-6 2v-2l4-2-1-8-11 4v-3l11-7z"/></svg><span>呼叫空襲</span>';
    this.element.style.cssText = 'position:absolute;z-index:1;left:calc(var(--hud-safe-left) + 12px);bottom:calc(var(--combat-slot-bottom) + 196px);width:54px;height:54px;box-sizing:border-box;padding:3px;display:grid;place-items:center;gap:1px;border:2px solid #efcc84;border-radius:10px;color:#fff0ca;background:#233f50ed;box-shadow:inset 0 0 0 2px #101d29,0 3px 0 #101d29;font:700 10px sans-serif;touch-action:manipulation;cursor:pointer';
    (this.element.querySelector('svg') as SVGElement).style.cssText = 'width:26px;height:26px';
    this.element.addEventListener('pointerdown', this.stopPointer); this.element.addEventListener('click', this.click);
    this.reset(); host.append(this.element);
  }
  update(state: SimulationFrameState, enabled: boolean): void {
    const air = state.commanderSupport?.airstrike;
    const visible = state.catharsis?.balance.commanderSupport?.heavyRaid?.lastStand?.triggerPolicy === 'manualPlayerCall'
      && !!air?.manual?.ready && air.status === 'ready' && state.squad.count > 0
      && state.defenseTank?.status === 'active' && state.defenseTank.phase === 3;
    this.element.hidden = !visible; this.element.style.display = visible ? 'grid' : 'none';
    this.element.disabled = !visible || !enabled;
  }
  reset(): void { this.element.hidden = true; this.element.style.display = 'none'; this.element.disabled = true; }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer); this.element.removeEventListener('click', this.click); this.element.remove();
  }
}
