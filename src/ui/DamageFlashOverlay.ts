export class DamageFlashOverlay {
  private readonly element: HTMLDivElement;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'damage-flash-overlay';
    this.element.setAttribute('aria-hidden', 'true');
    viewport.append(this.element);
  }

  flash(fatal: boolean): void {
    this.reset();
    // Restart the CSS animation even when casualties arrive in adjacent frames.
    void this.element.offsetWidth;
    this.element.classList.add(fatal ? 'damage-flash-overlay--fatal' : 'damage-flash-overlay--normal');
  }

  reset(): void {
    this.element.classList.remove('damage-flash-overlay--normal', 'damage-flash-overlay--fatal');
  }

  dispose(): void {
    this.element.remove();
  }
}
