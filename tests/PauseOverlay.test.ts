import {afterEach, expect, it, vi} from 'vitest';
import {PauseOverlay} from '../src/ui/PauseOverlay';
class ElementStub extends EventTarget {
  className = ''; type = ''; textContent = ''; hidden = false; inert = false; removed = false;
  readonly children: ElementStub[] = [];
  readonly classList = {contains: (name: string) => this.className === name};
  readonly attributes = new Map<string, string>();
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  blur = vi.fn();
  remove(): void { this.removed = true; }
}
afterEach(()=>vi.unstubAllGlobals());
it('resumes only through the native button, blocks underlying UI and restores its previous inert state',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const viewport=new ElementStub(),results=new ElementStub(),hud=new ElementStub(),alreadyBlocked=new ElementStub();
  const menu=new ElementStub();menu.className='tuning-panel';
  hud.className='hud-actions'; alreadyBlocked.inert=true;viewport.append(results,hud,alreadyBlocked,menu);
  const resume=vi.fn(),overlay=new PauseOverlay(viewport as unknown as HTMLElement,resume);
  const root=viewport.children[4],button=root.children[0];
  expect(button.type).toBe('button');expect(button.attributes.get('aria-label')).toBe('繼續遊戲');expect(button.textContent).toBe('暫停');
  overlay.setVisible(true);expect(results.inert).toBe(true);expect(hud.inert).toBe(false);
  expect(menu.inert).toBe(false);overlay.setMenuOpen(true);
  expect(button.hidden).toBe(true);expect(root.hidden).toBe(false);expect(results.inert).toBe(true);
  button.dispatchEvent(new Event('click'));expect(resume).not.toHaveBeenCalled();overlay.setMenuOpen(false);
  root.dispatchEvent(new Event('click'));root.dispatchEvent(new Event('pointerdown'));expect(resume).not.toHaveBeenCalled();
  button.dispatchEvent(new Event('click'));expect(resume).toHaveBeenCalledOnce();
  overlay.setVisible(false);expect(results.inert).toBe(false);expect(alreadyBlocked.inert).toBe(true);
  button.dispatchEvent(new Event('click'));expect(resume).toHaveBeenCalledOnce();
  overlay.setVisible(true);overlay.dispose();expect(results.inert).toBe(false);expect(root.removed).toBe(true);
  button.dispatchEvent(new Event('click'));expect(resume).toHaveBeenCalledOnce();
});
