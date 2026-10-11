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
  append(...children: ElementStub[]) { this.children.push(...children); }
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

it('adds independent touch-friendly NAVAL BARRAGE selection and restores its selected state',()=>{
  const {controls,select}=setup(),section=controls.navalBarrage as unknown as ElementStub;
  expect(section.tagName).toBe('DETAILS');expect(section.children[0].textContent).toBe('NAVAL BARRAGE');
  const buttons=section.children[1].children;
  expect(buttons.map(b=>b.textContent)).toEqual(['BARRAGE ON','BARRAGE OFF','LV8','LV9','LV10']);
  buttons[1].dispatchEvent(new Event('click'));expect(select.mock.lastCall).toEqual(['barrage10-off']);
  controls.setSelected('barrage10-off');buttons[2].dispatchEvent(new Event('click'));expect(select.mock.lastCall).toEqual(['barrage8-off']);
  controls.setSelected('barrage9-on');expect(buttons.filter(b=>b.attrs['aria-pressed']==='true').map(b=>b.textContent)).toEqual(['BARRAGE ON','LV9']);
  for(const b of buttons)expect(b.style.cssText).toContain('min-height:48px');controls.dispose();expect(section.remove).toHaveBeenCalledOnce();
});

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

it('adds a separate collapsible MG TEST section with five touch presets and shared selected state',()=>{
  const {controls,root,select}=setup(),section=controls.mgTest as unknown as ElementStub;
  expect(section.tagName).toBe('DETAILS');expect(section.children[0].textContent).toBe('MG TEST');
  const buttons=section.children[1].children;
  expect(buttons.map(b=>b.textContent)).toEqual(['MG6','MG7','MG8','MG9','MG10']);
  for(const button of buttons){
    expect(button.style.cssText).toContain('min-height:48px');
    button.dispatchEvent(new Event('click'));controls.setSelected(button.dataset.role as 'mg6');
    expect(select.mock.lastCall).toEqual([button.dataset.role]);expect(button.blur).toHaveBeenCalledOnce();
    expect(buttons.filter(b=>b.attrs['aria-pressed']==='true')).toEqual([button]);
    expect(root.children.every(b=>b.attrs['aria-pressed']==='false')).toBe(true);
  }
  controls.setSelected('late');expect(buttons.every(b=>b.attrs['aria-pressed']==='false')).toBe(true);
  controls.dispose();expect(section.remove).toHaveBeenCalledOnce();
});

it('adds collapsible Survival level/mode controls without changing the existing groups',()=>{
  const {controls,select}=setup(),section=controls.survivalTest as unknown as ElementStub;
  expect(section.tagName).toBe('DETAILS');expect(section.children[0].textContent).toBe('SURVIVAL TEST');
  const buttons=section.children[1].children;
  expect(buttons.map(b=>b.textContent)).toEqual(['BASELINE','EXPERIMENTAL','STAGED','AHEAD','LV7','LV8','LV9','LV10']);
  for(const b of buttons)expect(b.style.cssText).toContain('min-height:48px');
  buttons[0].dispatchEvent(new Event('click'));expect(select.mock.lastCall).toEqual(['survival8-baseline']);
  controls.setSelected('survival8-baseline');
  buttons[7].dispatchEvent(new Event('click'));expect(select.mock.lastCall).toEqual(['survival10-baseline']);
  controls.setSelected('survival10-baseline');
  buttons[1].dispatchEvent(new Event('click'));expect(select.mock.lastCall).toEqual(['survival10-experimental']);
  controls.setSelected('survival10-experimental');
  expect(buttons.filter(b=>b.attrs['aria-pressed']==='true').map(b=>b.textContent)).toEqual(['EXPERIMENTAL','LV10']);
  for(const mode of ['staged','ahead'] as const){
    buttons.find(b=>b.dataset.survival===mode)!.dispatchEvent(new Event('click'));
    expect(select.mock.lastCall).toEqual([`survival10-${mode}`]);controls.setSelected(`survival10-${mode}`);
    expect(buttons.filter(b=>b.attrs['aria-pressed']==='true').map(b=>b.textContent)).toEqual([mode.toUpperCase(),'LV10']);
  }
  controls.dispose();expect(section.remove).toHaveBeenCalledOnce();
});
