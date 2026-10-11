import { describe, expect, it, vi } from 'vitest';
import { ScreenWakeLock } from '../src/app/ScreenWakeLock';
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Sentinel extends EventTarget {
  released = false;
  pendingRelease: ReturnType<typeof deferred<void>> | null = null;
  release = vi.fn(async () => {
    if (this.pendingRelease) await this.pendingRelease.promise;
    this.systemRelease();
  });
  systemRelease() { this.released = true; this.dispatchEvent(new Event('release')); }
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
describe('event-driven screen Wake Lock', () => {
  it('acquires once, pauses/releases, and resumes with a new real sentinel', async () => {
    const sentinels = [new Sentinel(), new Sentinel()], request = vi.fn(async () => sentinels.shift()!);
    const lock = new ScreenWakeLock({ secure: true, request }), states = vi.fn(); lock.observe(states);
    expect(lock.status).toBe('released'); lock.setActive(true); expect(lock.status).toBe('requesting');
    await settle(); expect(lock.status).toBe('active'); lock.setActive(true); expect(request).toHaveBeenCalledTimes(1);
    lock.setActive(false); await settle(); expect(lock.status).toBe('released');
    lock.setActive(true); await settle(); expect(lock.status).toBe('active'); expect(request).toHaveBeenCalledTimes(2);
    lock.dispose(); await settle(); expect(lock.status).toBe('released');
  });
  it('never retains a request granted after Pause', async () => {
    const pending = deferred<Sentinel>(), sentinel = new Sentinel(), request = vi.fn(() => pending.promise);
    const lock = new ScreenWakeLock({ secure: true, request });
    lock.setActive(true); lock.setActive(false); pending.resolve(sentinel); await settle();
    expect(sentinel.release).toHaveBeenCalledTimes(1); expect(sentinel.released).toBe(true); expect(lock.status).toBe('released');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('serializes rapid Pause/Resume while a stale request and its release are pending', async () => {
    const first = deferred<Sentinel>(), a = new Sentinel(), b = new Sentinel(); a.pendingRelease = deferred<void>();
    const request = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(b);
    const lock = new ScreenWakeLock({ secure: true, request });
    lock.setActive(true); lock.setActive(false); lock.setActive(true); lock.setActive(false); lock.setActive(true);
    expect(request).toHaveBeenCalledTimes(1); first.resolve(a); await settle();
    expect(lock.status).toBe('releasing'); expect(request).toHaveBeenCalledTimes(1);
    a.pendingRelease.resolve(); await settle(); expect(a.released).toBe(true);
    expect(request).toHaveBeenCalledTimes(2); expect(lock.status).toBe('active');
    lock.dispose(); await settle(); expect(b.released).toBe(true);
  });
  it('waits for active-sentinel release before requesting another', async () => {
    const a = new Sentinel(), b = new Sentinel(), request = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    const lock = new ScreenWakeLock({ secure: true, request }); lock.setActive(true); await settle();
    a.pendingRelease = deferred<void>(); lock.setActive(false); lock.setActive(true); await settle();
    expect(request).toHaveBeenCalledTimes(1); a.pendingRelease.resolve(); await settle();
    expect(request).toHaveBeenCalledTimes(2); expect(lock.status).toBe('active'); lock.dispose(); await settle();
  });
  it('respects system/battery release without a retry loop', async () => {
    const a = new Sentinel(), b = new Sentinel(), request = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    const lock = new ScreenWakeLock({ secure: true, request }); lock.setActive(true); await settle();
    a.systemRelease(); await settle(); expect(lock.status).toBe('released'); expect(request).toHaveBeenCalledTimes(1);
    lock.setActive(true); await settle(); expect(lock.status).toBe('active'); lock.dispose(); await settle();
  });
  it('handles denial without blocking or automatically retrying', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Denied')), lock = new ScreenWakeLock({ secure: true, request });
    lock.setActive(true); await settle(); expect(lock.status).toBe('error'); expect(request).toHaveBeenCalledTimes(1);
    lock.setActive(false); lock.setActive(true); await settle(); expect(request).toHaveBeenCalledTimes(2);
  });
  it.each(['insecure', 'unsupported'] as const)('handles %s without requesting', async kind => {
    const request = vi.fn(), lock = new ScreenWakeLock({ secure: kind !== 'insecure', request: kind === 'insecure' ? request : undefined });
    lock.setActive(true); lock.setActive(false); lock.dispose(); await settle();
    expect(lock.status).toBe(kind); expect(request).not.toHaveBeenCalled();
  });
  it('cleans up a pending grant after disposal and never reacquires', async () => {
    const pending = deferred<Sentinel>(), s = new Sentinel(), request = vi.fn(() => pending.promise);
    const lock = new ScreenWakeLock({ secure: true, request }); lock.setActive(true); lock.dispose(); lock.setActive(true);
    pending.resolve(s); await settle(); expect(s.released).toBe(true); expect(request).toHaveBeenCalledTimes(1);
  });
  it('retains ownership on release failure instead of acquiring a second sentinel', async () => {
    const s = new Sentinel(), request = vi.fn(async () => s), lock = new ScreenWakeLock({ secure: true, request });
    lock.setActive(true); await settle(); s.release.mockRejectedValueOnce(new Error('OS failure'));
    lock.setActive(false); await settle(); expect(lock.status).toBe('error'); expect(s.released).toBe(false);
    lock.setActive(true); await settle(); expect(request).toHaveBeenCalledTimes(1);
    lock.setActive(false); await settle(); expect(s.released).toBe(true);
  });
  it('handles an already released grant and synchronous API failures', async () => {
    const s = new Sentinel(); s.systemRelease(); const lock = new ScreenWakeLock({ secure: true, request: async () => s });
    lock.setActive(true); await settle(); expect(lock.status).toBe('released');
    const bad = new ScreenWakeLock({ secure: true, request: () => { throw Error('Unavailable'); } });
    bad.setActive(true); await settle(); expect(bad.status).toBe('error');
  });
});
