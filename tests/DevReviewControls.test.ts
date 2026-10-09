import { afterEach, expect, it, vi } from 'vitest';
import { DevReviewControls } from '../src/ui/DevReviewControls';

class ElementStub extends EventTarget {
  children: ElementStub[] = [];
  style = { cssText: '', background: '' };
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  isContentEditable = false;
  interactiveAncestor = false;
  textContent = '';
  title = '';
  blur = vi.fn();
  remove = vi.fn();
  constructor(readonly tagName = 'DIV') { super(); }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  append(child: ElementStub) { this.children.push(child); }
  closest() { return this.interactiveAncestor ? this : null; }
}

function setup(enabled = true) {
  const windowTarget = new EventTarget();
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag.toUpperCase()) });
  const select = vi.fn(), canUse = vi.fn(() => enabled);
  const controls = new DevReviewControls(new ElementStub() as unknown as HTMLElement, select, canUse);
  const root = controls.element as unknown as ElementStub;
  const press = (code: string, options: { repeat?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; target?: ElementStub } = {}) => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({ code, key: 'unrelated', ...options })
      .map(([key, value]) => [key, { value }])));
    windowTarget.dispatchEvent(event);
    return event;
  };
  return { controls, root, select, canUse, press };
}

afterEach(() => vi.unstubAllGlobals());

it('routes physical 4/5/6 and CURVE/EVOLVE/MG clicks through exactly the same callback', () => {
  const { controls, root, select, press } = setup();
  expect(root.children.map(b => b.textContent)).toEqual(['GRENADE', 'CURVE', 'EVOLVE', 'MG', 'LATE', 'MG7', 'MG8', 'CARNIVAL', 'CRATE3', 'CRATE8']);
  for (const [index, code, role] of [[1, 'Digit4', 'curve'], [2, 'Digit5', 'evolve'], [3, 'Digit6', 'machineGun']] as const) {
    const button = root.children[index];
    button.dispatchEvent(new Event('click'));
    expect(select.mock.lastCall).toEqual([role]);
    expect(button.blur).toHaveBeenCalledOnce();
    expect(press(code).defaultPrevented).toBe(true);
    expect(select.mock.lastCall).toEqual([role]);
    controls.setSelected(role);
    expect(button.attrs['aria-pressed']).toBe('true');
    expect(button.title).toContain(`(${code.slice(-1)})`);
  }
  expect(select).toHaveBeenCalledTimes(6);
  controls.dispose();
});

it('ignores repeats, modifiers, unrelated keys and pre-start/stopped shortcuts', () => {
  const { controls, select, canUse, press } = setup(false);
  press('Digit4'); press('Digit5'); press('Digit6');
  canUse.mockReturnValue(true);
  for (const code of ['Digit4', 'Digit5', 'Digit6']) {
    press(code, { repeat: true }); press(code, { ctrlKey: true });
    press(code, { altKey: true }); press(code, { metaKey: true });
  }
  for (const code of ['KeyQ', 'KeyP', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Numpad5', 'Numpad6', 'Digit7', 'Digit8']) press(code);
  expect(select).not.toHaveBeenCalled();
  controls.dispose();
});

it.each(['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'SUMMARY', 'OPTION', 'editable', 'nested-interactive', 'TUNE'])
  ('ignores physical 5/6 from %s focus', kind => {
    const { controls, select, press } = setup();
    const target = new ElementStub(kind === 'editable' || kind === 'nested-interactive' || kind === 'TUNE' ? 'DIV' : kind);
    target.isContentEditable = kind === 'editable';
    target.interactiveAncestor = kind === 'nested-interactive' || kind === 'TUNE';
    expect(press('Digit4', { target }).defaultPrevented).toBe(false);
    expect(press('Digit5', { target }).defaultPrevented).toBe(false);
    expect(press('Digit6', { target }).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
    controls.dispose();
  });

it('removes the keyboard handler on disposal', () => {
  const { controls, root, select, press } = setup();
  controls.dispose(); press('Digit4'); press('Digit5'); press('Digit6');
  expect(select).not.toHaveBeenCalled();
  expect(root.remove).toHaveBeenCalledOnce();
});

it('selects all playable late entries through the same restart callback and releases focus', () => {
  const { controls, root, select } = setup();
  for (const role of ['late', 'mg7', 'mg8'] as const) {
    const button = root.children.find(b => b.dataset.role === role)!;
    button.dispatchEvent(new Event('click')); controls.setSelected(role);
    expect(select.mock.lastCall).toEqual([role]); expect(button.blur).toHaveBeenCalledOnce();
    expect(button.attrs['aria-pressed']).toBe('true'); expect(button.title).toContain('normal spawning');
  }
  controls.dispose();
});

it.each(['crate3', 'crate8'] as const)('restarts %s without adding a shortcut', role => {
  const { controls, root, select } = setup();
  const button = root.children.find(b => b.dataset.role === role)!;
  button.dispatchEvent(new Event('click')); controls.setSelected(role);
  expect(select.mock.lastCall).toEqual([role]); expect(button.blur).toHaveBeenCalledOnce();
  expect(button.attrs['aria-pressed']).toBe('true'); expect(button.title).toContain('Supply destruction');
  controls.dispose();
});
