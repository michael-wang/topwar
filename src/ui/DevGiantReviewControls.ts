// Only mounted in the isolated DEV route. No GPU resources or update loop.
export class DevGiantReviewControls {
  private readonly element = document.createElement('aside');
  constructor(viewport: HTMLElement, retry: () => void) {
    this.element.className = 'dev-giant-review';
    this.element.style.cssText = 'position:absolute;top:calc(48px + env(safe-area-inset-top,0px));left:8px;z-index:30;'
      + 'max-width:240px;padding:8px;background:#142332e8;color:#fff;font-size:12px;border:1px solid #af9960';
    const label = document.createElement('div');
    label.textContent = 'GIANT DEV・不覆寫存檔・關閉分頁返回';
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = '重測 GIANT';
    button.style.cssText = 'min-height:44px;min-width:140px;margin-top:6px;touch-action:manipulation';
    button.addEventListener('click', () => { retry(); button.blur(); });
    this.element.append(label, button); viewport.append(this.element);
  }
  dispose(): void { this.element.remove(); }
}
