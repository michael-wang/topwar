import { afterEach, expect, it, vi } from 'vitest';
import { ObserverPortraits } from '../src/ui/ObserverPortraits';
import * as publicAssets from '../src/core/publicAssetUrl';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
function harness() {
  const images: ImageStub[] = [];
  class ImageStub {
    src = ''; alt = ''; decoding = ''; naturalWidth = 110;
    resolve!: () => void; reject!: () => void;
    promise = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    decode = vi.fn(() => this.promise);
    removeAttribute = vi.fn(() => { this.src = ''; });
    constructor() { images.push(this); }
  }
  vi.stubGlobal('Image', ImageStub);
  const portraits = new ObserverPortraits();
  return { portraits, images };
}
it('starts both images immediately and exposes only decoded elements for reuse', async () => {
  const { portraits, images } = harness();
  expect(images.map(i => i.src)).toEqual(['/art/observer/neutral.webp', '/art/observer/alert.webp']);
  expect(portraits.readiness).toBe('pending'); expect(portraits.get('neutral')).toBeNull();
  images[0].resolve(); await Promise.resolve();
  expect(portraits.readiness).toBe('ready');
  expect(portraits.get('alert')).toBe(images[0]);
  images[1].resolve(); await Promise.resolve();
  expect(portraits.readiness).toBe('ready');
  expect(portraits.get('neutral')).toBe(images[0]); expect(portraits.get('alert')).toBe(images[1]);
  expect(portraits.get('victory')).toBe(images[0]);
  expect(images.every(i => i.decode.mock.calls.length === 1)).toBe(true); portraits.dispose();
});
it('prepares a supplied Victory portrait once and falls back to neutral if its decode fails', async () => {
  vi.spyOn(publicAssets, 'hasPublicAsset').mockReturnValue(true);
  const { portraits, images } = harness();
  expect(images[2].src).toBe('/art/observer/victory.webp');
  images[0].resolve(); images[2].reject(); await Promise.resolve();
  expect(portraits.get('victory')).toBe(images[0]); portraits.dispose();
  const ready = harness(); ready.images[2].resolve(); await Promise.resolve();
  expect(ready.portraits.get('victory')).toBe(ready.images[2]); ready.portraits.dispose();
});
it('uses the surviving decoded expression when one fails and bounds hung images', async () => {
  vi.useFakeTimers();
  const { portraits, images } = harness();
  images[1].resolve(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(8000);
  expect(portraits.readiness).toBe('ready');
  expect(portraits.get('neutral')).toBe(images[1]); expect(portraits.get('alert')).toBe(images[1]);
  images[0].resolve(); await Promise.resolve();
  expect(portraits.get('neutral')).toBe(images[1]); portraits.dispose();
});
it('rejects total failure and ignores completion after disposal', async () => {
  const { portraits, images } = harness();
  portraits.dispose(); images.forEach(i => i.resolve()); await Promise.resolve();
  expect(portraits.readiness).toBe('unavailable'); expect(portraits.get('neutral')).toBeNull();
  expect(images.every(i => i.removeAttribute.mock.calls.length === 1)).toBe(true);
});
