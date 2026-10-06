export const grenadeIcon = '<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M13 3h8v5h-8zM12 10h10l4 8-2 10H10L7 19z"/><path d="m22 4 5 2 2 8-3 1-2-7-3-1z"/></svg>';

export class GrenadeButton {
  private readonly element = document.createElement('button');
  private previousInventory = 0;
  private readonly stopPointer = (event: PointerEvent): void => event.stopPropagation();
  private readonly click = (): void => { if (!this.element.disabled) this.activate(); };
  constructor(viewport: HTMLElement, private readonly activate: () => void) {
    this.element.type = 'button'; this.element.className = 'grenade-button';
    this.element.innerHTML = `${grenadeIcon}<strong>1</strong><span>GRENADE</span>`;
    this.element.addEventListener('pointerdown', this.stopPointer);
    this.element.addEventListener('click', this.click);
    this.reset(); viewport.append(this.element);
  }
  update(inventory: number, acquired: boolean, enabled: boolean): void {
    this.element.hidden = !acquired;
    this.element.disabled = !enabled || inventory === 0;
    this.element.setAttribute('aria-label', `Throw Grenade (${inventory} available)`);
    this.element.querySelector('strong')!.textContent = String(inventory);
    if (inventory > this.previousInventory) this.element.classList.add('grenade-ready');
    if (inventory === 0) this.element.classList.remove('grenade-ready');
    this.previousInventory = inventory;
  }
  reset(): void {
    this.element.hidden = true; this.element.disabled = true; this.previousInventory = 0;
    this.element.classList.remove('grenade-ready');
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.element.removeEventListener('click', this.click); this.element.remove();
  }
}
