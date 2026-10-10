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

function setup() {
  const windowTarget = new EventTarget();
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('document', { createElement: (tag: string) => new ElementStub(tag.toUpperCase()) });
  const select = vi.fn();
  const controls = new DevReviewControls(new ElementStub() as unknown as HTMLElement, select);
  const root = controls.element as unknown as ElementStub;
  const press = (code: string, options: { repeat?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; target?: ElementStub } = {}) => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({ code, key: 'unrelated', ...options })
      .map(([key, value]) => [key, { value }])));
    windowTarget.dispatchEvent(event);
    return event;
  };
  return { controls, root, select, press };
}

afterEach(() => vi.unstubAllGlobals());

it('exposes exactly four working mobile fixture buttons, with one selected state', () => {
  const {controls,root,select}=setup();
  expect(root.children.map(b=>b.textContent)).toEqual(['LATE','CRATE3','CRATE8','NAVAL']);
  for(const role of ['late','crate3','crate8','naval'] as const){
    const button=root.children.find(b=>b.dataset.role===role)!;
    expect(button.style.cssText).toContain('min-height:44px');
    expect(button.title).not.toBe('');
    button.dispatchEvent(new Event('click'));controls.setSelected(role);
    expect(select.mock.lastCall).toEqual([role]);expect(button.blur).toHaveBeenCalledOnce();
    expect(root.children.filter(b=>b.attrs['aria-pressed']==='true')).toEqual([button]);
  }
  expect(select).toHaveBeenCalledTimes(4);controls.dispose();expect(root.remove).toHaveBeenCalledOnce();
});

it('does not install the obsolete 4/5/6 shortcuts',()=>{
  const {controls,select,press}=setup();
  for(const code of ['Digit4','Digit5','Digit6'])expect(press(code).defaultPrevented).toBe(false);
  expect(select).not.toHaveBeenCalled();controls.dispose();
});
