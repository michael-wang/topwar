import type { ScreenWakeLock, WakeStatus } from '../app/ScreenWakeLock';
const labels: Record<WakeStatus, string> = {
  active: 'ACTIVE', released: 'RELEASED / PAUSED', requesting: 'REQUESTING', releasing: 'RELEASING',
  insecure: 'UNAVAILABLE — INSECURE ORIGIN', unsupported: 'UNSUPPORTED', error: 'DENIED / ERROR',
};
export class DevWakeStatus {
  private readonly element = document.createElement('p');
  constructor(host: HTMLElement, private readonly lock: ScreenWakeLock, onChange?: (status: WakeStatus) => void) {
    this.element.className = 'dev-wake-status';
    this.element.style.cssText = 'margin:8px 0;padding:8px;border-radius:6px;background:#14212b;color:#fff3dc;font:700 14px/1.4 sans-serif';
    this.element.setAttribute('role', 'status'); host.prepend(this.element);
    lock.observe(status => { this.element.textContent = `SCREEN: ${labels[status]}`; onChange?.(status); });
  }
  dispose(): void { this.lock.observe(null); this.element.remove(); }
}
