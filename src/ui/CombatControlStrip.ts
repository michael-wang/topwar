// Defense-only controls. Input owns held state; XP remains a pointer-transparent child.
export class CombatControlStrip {
  readonly element = document.createElement('div');
  readonly progressionHost = document.createElement('div');
  readonly buttons: readonly [HTMLButtonElement, HTMLButtonElement];

  constructor(viewport: HTMLElement) {
    this.element.className = 'combat-control-strip';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Movement and progression');
    this.progressionHost.className = 'combat-progression';
    this.buttons = [-1, 1].map(direction => {
      const button = document.createElement('button'), left = direction === -1;
      button.type = 'button'; button.disabled = true; button.draggable = false;
      button.className = `movement-button movement-${left ? 'left' : 'right'}`;
      button.setAttribute('aria-label', `Move ${left ? 'left' : 'right'}`);
      button.setAttribute('aria-pressed', 'false');
      button.title = `Hold to step ${left ? 'left (A / ←)' : 'right (D / →)'}`;
      button.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${left ? 'M20 7 11 16 20 25M12 16h13' : 'M12 7 21 16 12 25M20 16H7'}"/></svg><span class="combat-keycue" aria-hidden="true">${left ? 'A' : 'D'}</span>`;
      return button;
    }) as [HTMLButtonElement, HTMLButtonElement];
    this.element.append(this.buttons[0], this.progressionHost, this.buttons[1]);
    viewport.append(this.element);
  }

  dispose(): void { this.element.remove(); }
}
