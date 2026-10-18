// Defense-only controls. Input owns held state; XP remains a pointer-transparent child.
export class CombatControlStrip {
  readonly element = document.createElement('div');
  readonly progressionHost = document.createElement('div');
  readonly buttons: readonly [HTMLButtonElement, HTMLButtonElement];

  constructor(viewport: HTMLElement) {
    this.element.className = 'combat-control-strip';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', '移動與升級');
    this.progressionHost.className = 'combat-progression';
    this.buttons = [-1, 1].map(direction => {
      const button = document.createElement('button'), left = direction === -1;
      button.type = 'button'; button.disabled = true; button.draggable = false;
      button.className = `movement-button movement-${left ? 'left' : 'right'}`;
      button.setAttribute('aria-label', `${left ? '向左移動' : '向右移動'}`);
      button.setAttribute('aria-pressed', 'false');
      button.title = `按住向${left ? '左移動（A / ←）' : '右移動（D / →）'}`;
      button.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="${left ? 'M31 10H15V2L1 16l14 14v-8h16z' : 'M1 10h16V2l14 14-14 14v-8H1z'}"/></svg><span class="combat-keycue" aria-hidden="true">${left ? 'A' : 'D'}</span>`;
      const touchArea = document.createElement('span');
      touchArea.className = 'movement-touch-area'; touchArea.setAttribute('aria-hidden', 'true');
      button.append(touchArea);
      return button;
    }) as [HTMLButtonElement, HTMLButtonElement];
    this.element.append(this.buttons[0], this.progressionHost, this.buttons[1]);
    viewport.append(this.element);
  }

  dispose(): void { this.element.remove(); }
}
