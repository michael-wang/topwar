import { afterEach, expect, it, vi } from 'vitest';
import { CreditsOverlay } from '../src/ui/CreditsOverlay';

class Element extends EventTarget {
  style = { backgroundImage: '' };
  children: Element[] = []; open = false; textContent = ''; className = ''; focus = vi.fn(); remove = vi.fn();
  setAttribute = vi.fn();
  append(...children: Element[]) { this.children.push(...children); }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}
class Music {
  volume = 1;
  static instances: Music[] = []; static reject = false;
  play = vi.fn(() => Music.reject ? Promise.reject(new Error("autoplay denied")) : Promise.resolve()); pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn();
  constructor(readonly src: string) { Music.instances.push(this); }
}
function setup() {
  Music.instances = []; Music.reject = false;
  const doc = Object.assign(new EventTarget(), { createElement: () => new Element(), hidden: false });
  vi.stubGlobal('document', doc); vi.stubGlobal('Audio', Music);
  const host = new Element(), overlay = new CreditsOverlay(host as unknown as HTMLElement);
  return { doc, overlay, entry: host.children[0], dialog: host.children[1] };
}
afterEach(() => vi.unstubAllGlobals());
it('preserves approved names, opens only on a gesture and returns without any game callback', () => {
  const { overlay, entry, dialog } = setup();
  expect(Music.instances).toHaveLength(0);
  expect(dialog.children[0].children[1].textContent).toBe('CREDITS');
  expect(dialog.children[1].children.map(row => row.children.slice(1).map(e => e.textContent)))
    .toEqual([['疾如風','遊戲製作'],['阿弘','音樂'],['阿翔','測試'],['小楷甯','點子、測試'],['Julia、扣碟子','協作']]);
  entry.dispatchEvent(new Event('click'));
  expect(dialog.open).toBe(true); expect(Music.instances[0].src).toContain('stage1-complete');
  expect(Music.instances[0].play).toHaveBeenCalledOnce();
  expect(Music.instances[0].volume).toBe(.225);
  dialog.children[2].dispatchEvent(new Event('click'));
  expect(dialog.open).toBe(false); expect(Music.instances[0].pause).toHaveBeenCalledOnce();
  expect(entry.focus).toHaveBeenCalledOnce(); overlay.dispose();
});
it('stops only its own music on native dialog dismissal, background and disposal', () => {
  const { doc, overlay, entry, dialog } = setup();
  entry.dispatchEvent(new Event('click')); dialog.close(); expect(Music.instances[0].pause).toHaveBeenCalledOnce();
  entry.dispatchEvent(new Event('click')); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  expect(Music.instances[1].pause).toHaveBeenCalledOnce(); dialog.close();
  entry.dispatchEvent(new Event('click')); overlay.dispose(); expect(Music.instances[2].pause).toHaveBeenCalledOnce();
  expect(entry.remove).toHaveBeenCalledOnce(); expect(dialog.remove).toHaveBeenCalledOnce();
});
it('keeps Return usable when the browser rejects playback', async () => {
  const { overlay, entry, dialog } = setup();
  Music.reject = true;
  entry.dispatchEvent(new Event('click')); await Promise.resolve();
  dialog.children[2].dispatchEvent(new Event('click')); expect(dialog.open).toBe(false); overlay.dispose();
});

it('keeps Xiang as Grunt, assigns Kai a player soldier and restores static collaboration art', () => {
  const { overlay, dialog } = setup();
  const rows = dialog.children[1].children;
  expect(rows[0].className).toBe('credits-producer');
  expect(rows[0].children[0].style.backgroundImage).toContain('art/credits/giant-front-walk');
  expect(rows[0].children[0].setAttribute).toHaveBeenCalledWith('aria-label','GIANT');
  expect(rows).toHaveLength(5);
  expect(rows[1].children[0].style.backgroundImage).toContain('heavy-front-walk');
  expect(rows[2].children[0].style.backgroundImage).toContain('grunt-front-walk');
  expect(rows[2].children[0].setAttribute).toHaveBeenCalledWith('aria-label','GRUNT');
  expect(rows[3].children[0].style.backgroundImage).toContain('player-front-walk');
  expect(rows[3].children[0].setAttribute).toHaveBeenCalledWith('aria-label','我方士兵');
  expect(rows[4].children[0].className).toBe('credits-portrait');
  expect(rows[4].children[0].style.backgroundImage).toContain('art/victory/commander-soldier');
  expect(rows[4].children[0].setAttribute).toHaveBeenCalledWith('aria-label','Julia、扣碟子');
  overlay.dispose();
});
