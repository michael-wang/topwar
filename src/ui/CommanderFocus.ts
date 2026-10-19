export interface FocusArea { x: number; y: number; width: number; height: number }

/** One stationary area per spoken cue. Geometry is refreshed only on viewport changes. */
export class CommanderFocus {
  readonly element = document.createElement('div');
  private key = '';
  private viewportKey = '';
  constructor(host: HTMLElement) {
    this.element.className = 'commander-focus';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.style.cssText = 'position:absolute;z-index:8;pointer-events:none;box-sizing:border-box';
    const style = document.createElement('style');
    style.textContent = `.commander-focus i{position:absolute;width:22px;height:22px;border:4px solid #ed344b;filter:drop-shadow(0 0 3px #560a18);box-sizing:border-box;animation:commander-focus-pulse 1.6s ease-in-out infinite}
      .commander-focus i:nth-of-type(1){left:0;top:0;border-right:0;border-bottom:0;transform-origin:100% 100%}
      .commander-focus i:nth-of-type(2){right:0;top:0;border-left:0;border-bottom:0;transform-origin:0 100%}
      .commander-focus i:nth-of-type(3){left:0;bottom:0;border-right:0;border-top:0;transform-origin:100% 0}
      .commander-focus i:nth-of-type(4){right:0;bottom:0;border-left:0;border-top:0;transform-origin:0 0}
      @keyframes commander-focus-pulse{0%,100%{transform:scale(.85);opacity:.65;filter:drop-shadow(0 0 2px #560a18)}50%{transform:scale(1.25);opacity:1;filter:drop-shadow(0 0 7px #ff344b)}}
      .commander-focus[data-paused=true] i{animation-play-state:paused}
      @media(prefers-reduced-motion:reduce){.commander-focus i{animation:none;opacity:1}}`;
    this.element.append(style);
    for (let i = 0; i < 4; i++) this.element.append(document.createElement('i'));
    this.clear(); host.append(this.element);
  }
  update(key: string | null, area: FocusArea | null | (() => FocusArea | null), viewportKey: string, paused: boolean): void {
    this.element.setAttribute('data-paused', String(paused));
    if (!key) { this.clear(); return; }
    if (key !== this.key || viewportKey !== this.viewportKey || this.element.hidden) {
      const captured = typeof area === 'function' ? area() : area;
      this.clear();
      if (!captured) return;
      area = captured;
      this.key = key; this.viewportKey = viewportKey;
      Object.assign(this.element.style, { left: `${area.x}px`, top: `${area.y}px`, width: `${area.width}px`, height: `${area.height}px` });
    }
    this.element.hidden = false;
  }
  clear(): void { this.element.hidden = true; this.key = ''; }
  dispose(): void { this.element.remove(); }
}
