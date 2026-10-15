import type { SimulationFrameState } from '../simulation/SimulationState';
import { ART } from '../art/ArtDirection';
import { LEVEL_UP_MS } from '../presentation/ProgressionLevelUp';

// Policy-gated one-use control, including the shared manual Air Support scene.
export class ManualAirSupportButton {
  readonly element = document.createElement('button');
  private readonly ring: HTMLElement;
  private readonly icon: SVGElement;
  private readonly motes: HTMLElement[] = [];
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
    this.element.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M14 3h4l1 10 11 7v3l-11-4-1 8 4 2v2l-6-2-6 2v-2l4-2-1-8-11 4v-3l11-7z"/></svg><strong aria-hidden="true">1</strong><i aria-hidden="true"></i>';
    this.element.style.cssText = 'position:absolute;z-index:1;left:calc(var(--hud-safe-left) + 7px);bottom:calc(var(--combat-slot-bottom) + 74px);width:64px;height:64px;box-sizing:border-box;padding:5px;display:grid;place-items:center;gap:1px;border:2px solid #efcc84;border-radius:15px;color:#fff0ca;background:linear-gradient(145deg,#344f61,#172835 65%);box-shadow:inset 0 0 0 2px #101d29,0 3px 0 #101d29;font:700 10px sans-serif;touch-action:manipulation;cursor:pointer';
    this.icon = this.element.querySelector('svg')!; this.icon.style.cssText = 'width:38px;height:38px';
    (this.element.querySelector('strong') as HTMLElement).style.cssText = 'position:absolute;top:-5px;right:-5px;min-width:18px;padding:2px;border:2px solid #33222b;border-radius:7px;background:#ff922f;color:#241e24;font:900 16px sans-serif;line-height:1;text-align:center';
    this.ring = this.element.querySelector('i')!;
    const colors = ART.coastalUi;
    this.ring.style.cssText = `position:absolute;inset:-3px;border:4px solid ${colors.aqua};border-radius:50%;box-shadow:0 0 10px ${colors.energy},inset 0 0 6px ${colors.foam};pointer-events:none;opacity:0`;
    for (let i = 0; i < 8; i++) {
      const mote = document.createElement('span'); mote.setAttribute('aria-hidden', 'true');
      mote.style.cssText = `position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:${i % 2 ? colors.foam : colors.energy};box-shadow:0 0 7px ${colors.foam};pointer-events:none;opacity:0`;
      this.motes.push(mote); this.element.append(mote);
    }
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
    const age = nowMs - this.readyAtMs, active = visible && age >= 0 && age < LEVEL_UP_MS;
    const t = active ? age / LEVEL_UP_MS : 1, reduced = this.reducedMotion?.matches ?? false;
    const glow = active ? Math.pow(1 - t, .7) : 0, colors = ART.coastalUi;
    this.ring.style.opacity = String(active ? .95 * (1 - t) : 0);
    this.ring.style.transform = `scale(${reduced ? 1.15 : .65 + 2 * t})`;
    this.motes.forEach((mote, i) => {
      const angle = i * Math.PI * 2 / 8 + (reduced ? 0 : t * .8), radius = reduced ? 30 : 20 + 38 * t;
      mote.style.opacity = String(active ? Math.min(1, (1 - t) * 1.8) : 0);
      mote.style.transform = `translate(-50%,-50%) translate(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius}px) scale(${reduced ? 1 : 1.15 - .6 * t})`;
    });
    this.icon.style.filter = glow ? `brightness(${1 + glow}) drop-shadow(0 0 ${glow * 7}px ${colors.foam}) drop-shadow(0 0 ${glow * 10}px ${colors.sun})` : '';
    this.element.style.boxShadow = `inset 0 0 0 2px #101d29,0 3px 0 #101d29,0 0 ${glow * 26}px ${glow * 5}px ${colors.aqua}`;
  }
  reset(): void {
    this.readinessSeen = false; this.readyAtMs = -Infinity;
    this.element.hidden = true; this.element.style.display = 'none'; this.element.disabled = true;
    this.ring.style.opacity = '0'; this.icon.style.filter = '';
    this.motes.forEach(mote => mote.style.opacity = '0');
  }
  restore(state: SimulationFrameState): void {
    this.reset(); this.readinessSeen = !!state.commanderSupport?.airstrike?.manual?.ready;
    this.update(state, false);
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer); this.element.removeEventListener('click', this.click); this.element.remove();
  }
}
