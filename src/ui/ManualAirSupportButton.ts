import type { SimulationFrameState } from '../simulation/SimulationState';

// Created only by local DEV. Placement is provisional pending phone review.
export class ManualAirSupportButton {
  readonly element = document.createElement('button');
  private readonly ring: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  private readinessSeen = false;
  private readyAtMs = -Infinity;
  private readonly stopPointer = (event: Event): void => event.stopPropagation();
  private readonly click = (): void => {
    if (!this.element.disabled && this.activate()) this.element.disabled = true;
  };
  constructor(host: HTMLElement, private readonly activate: () => boolean) {
    this.element.type = 'button'; this.element.className = 'manual-air-support';
    this.element.setAttribute('aria-label', '呼叫空襲'); this.element.title = '呼叫空襲（一次）';
    this.element.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M14 3h4l1 10 11 7v3l-11-4-1 8 4 2v2l-6-2-6 2v-2l4-2-1-8-11 4v-3l11-7z"/></svg><span>呼叫空襲</span><strong aria-hidden="true">1</strong><i aria-hidden="true"></i><em aria-hidden="true">空襲就緒</em>';
    this.element.style.cssText = 'position:absolute;z-index:1;left:calc(var(--hud-safe-left) + 7px);bottom:calc(var(--combat-slot-bottom) + 74px);width:64px;height:64px;box-sizing:border-box;padding:5px;display:grid;place-items:center;gap:1px;border:2px solid #efcc84;border-radius:15px;color:#fff0ca;background:linear-gradient(145deg,#344f61,#172835 65%);box-shadow:inset 0 0 0 2px #101d29,0 3px 0 #101d29;font:700 10px sans-serif;touch-action:manipulation;cursor:pointer';
    (this.element.querySelector('svg') as SVGElement).style.cssText = 'width:30px;height:30px';
    (this.element.querySelector('strong') as HTMLElement).style.cssText = 'position:absolute;top:-5px;right:-5px;min-width:18px;padding:2px;border:2px solid #33222b;border-radius:7px;background:#ff922f;color:#241e24;font:900 16px sans-serif;line-height:1;text-align:center';
    this.ring = this.element.querySelector('i')!;
    this.ring.style.cssText = 'position:absolute;inset:-4px;border:3px solid #fff0ca;border-radius:inherit;pointer-events:none;opacity:0';
    this.cue = this.element.querySelector('em')!;
    this.cue.style.cssText = 'position:absolute;bottom:calc(100% + 9px);left:-2px;width:72px;padding:3px 0;border:1px solid #efd491;border-radius:5px;color:#fff5d6;background:#172835ed;font:800 11px sans-serif;pointer-events:none;opacity:0';
    this.element.addEventListener('pointerdown', this.stopPointer); this.element.addEventListener('click', this.click);
    this.reset(); host.append(this.element);
  }
  update(state: SimulationFrameState, enabled: boolean, nowMs = 0): void {
    const air = state.commanderSupport?.airstrike;
    const visible = state.catharsis?.balance.commanderSupport?.heavyRaid?.lastStand?.triggerPolicy === 'manualPlayerCall'
      && !!air?.manual?.ready && air.status === 'ready' && state.squad.count > 0
      && state.defenseTank?.status === 'active' && state.defenseTank.phase === 3;
    this.element.hidden = !visible; this.element.style.display = visible ? 'grid' : 'none';
    this.element.disabled = !visible || !enabled;
    if (visible && !this.readinessSeen) { this.readinessSeen = true; this.readyAtMs = nowMs; }
    const age = nowMs - this.readyAtMs, active = visible && age >= 0 && age < 1350;
    const t = active ? age / 1350 : 1, reduced = this.reducedMotion?.matches ?? false;
    const glow = active ? (reduced ? 1 - t : (1 - t) * (.55 + .45 * Math.sin(t * Math.PI * 3) ** 2)) : 0;
    this.ring.style.opacity = String(active ? (reduced ? .8 * (1 - t) : (1 - (t * 2 % 1)) * (1 - t)) : 0);
    this.ring.style.transform = `scale(${reduced ? 1 : 1 + (t * 2 % 1) * .65})`;
    this.cue.style.opacity = String(active ? Math.min(1, (1 - t) * 4) : 0);
    this.element.style.boxShadow = `inset 0 0 0 2px #101d29,0 3px 0 #101d29,0 0 ${glow * 24}px ${glow * 5}px #f6d991`;
  }
  reset(): void {
    this.readinessSeen = false; this.readyAtMs = -Infinity;
    this.element.hidden = true; this.element.style.display = 'none'; this.element.disabled = true;
    this.ring.style.opacity = this.cue.style.opacity = '0';
  }
  restore(state: SimulationFrameState): void {
    this.reset(); this.readinessSeen = !!state.commanderSupport?.airstrike?.manual?.ready;
    this.update(state, false);
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer); this.element.removeEventListener('click', this.click); this.element.remove();
  }
}
