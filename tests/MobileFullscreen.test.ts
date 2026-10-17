import { afterEach, expect, it, vi } from 'vitest';
import { MobileFullscreen } from '../src/app/MobileFullscreen';

class Node extends EventTarget {
  children: Node[] = []; hidden = false; disabled = false; removed = false;
  append(node: Node) { this.children.push(node); }
  remove() { this.removed = true; }
}
function setup() {
  const doc = Object.assign(new EventTarget(), { fullscreenElement: null as Node | null,
    fullscreenEnabled: true, createElement: () => new Node() });
  const win = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', { maxTouchPoints: 1 });
  const enter = vi.fn(async () => {}), host = new Node();
  const viewport = Object.assign(new Node(), { requestFullscreen: enter });
  const mode = new MobileFullscreen(viewport as unknown as HTMLElement), audio = vi.fn();
  mode.mount(host as unknown as HTMLElement, audio);
  return { doc, win, enter, mode, audio, viewport, button: host.children[0] };
}
afterEach(() => vi.unstubAllGlobals());

it('uses the native API immediately, ignores pending duplicates and respects external exits', async () => {
  const { mode, enter, doc, viewport, button, audio } = setup();
  let resolve!: () => void; enter.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  expect(enter).not.toHaveBeenCalled(); mode.request(); mode.request();
  expect(enter).toHaveBeenCalledOnce(); expect(enter).toHaveBeenCalledWith({ navigationUI: 'hide' });
  expect(button.disabled).toBe(true); expect(audio).not.toHaveBeenCalled();
  doc.fullscreenElement = viewport; doc.dispatchEvent(new Event('fullscreenchange'));
  expect(button.hidden).toBe(true); resolve(); await Promise.resolve();
  doc.fullscreenElement = null; doc.dispatchEvent(new Event('fullscreenchange'));
  expect(button.hidden).toBe(false); expect(enter).toHaveBeenCalledOnce();
  button.dispatchEvent(new Event('click')); expect(audio).toHaveBeenCalledOnce(); expect(enter).toHaveBeenCalledTimes(2);
  expect(audio.mock.invocationCallOrder[0]).toBeLessThan(enter.mock.invocationCallOrder[1]);
  mode.dispose(); expect(button.removed).toBe(true);
  button.dispatchEvent(new Event('click')); doc.dispatchEvent(new Event('fullscreenchange'));
  mode.request(); expect(enter).toHaveBeenCalledTimes(2);
});

it('recovers rejection and synchronous failure; unsupported, landscape and desktop never request', async () => {
  const { mode, enter, doc, win, button } = setup();
  enter.mockRejectedValueOnce(new Error('denied')); mode.request(); await Promise.resolve();
  expect(button.disabled).toBe(false); expect(doc.fullscreenElement).toBeNull();
  enter.mockImplementationOnce(() => { throw new Error('blocked'); }); mode.request(); expect(button.disabled).toBe(false);
  doc.fullscreenEnabled = false; mode.request(); doc.fullscreenEnabled = true;
  win.innerWidth = 900; mode.request(); win.innerWidth = 390;
  vi.stubGlobal('navigator', { maxTouchPoints: 0 }); mode.request();
  expect(enter).toHaveBeenCalledTimes(2);
  mode.dispose();
});

it('cleans up while a request is pending without late UI mutations', async () => {
  const { mode, enter, button } = setup(); let resolve!: () => void;
  enter.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  mode.request(); mode.dispose(); resolve(); await Promise.resolve();
  expect(button.removed).toBe(true); expect(button.disabled).toBe(true);
});
