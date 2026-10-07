import { afterEach, expect, it, vi } from 'vitest';
import { CombatControlStrip } from '../src/ui/CombatControlStrip';
class Element {
  children:Element[]=[];className='';attributes:Record<string,string>={};innerHTML='';disabled=false;type='';draggable=true;removed=false;
  append(...children:Element[]){this.children.push(...children);}
  setAttribute(k:string,v:string){this.attributes[k]=v;}
  remove(){this.removed=true;}
}
afterEach(()=>vi.unstubAllGlobals());
it('places accessible visible movement buttons around a dedicated progression host, disabled before start',()=>{
  vi.stubGlobal('document',{createElement:()=>new Element()});const viewport=new Element();
  const strip=new CombatControlStrip(viewport as unknown as HTMLElement),root=viewport.children[0];
  expect(root.className).toBe('combat-control-strip');
  expect(root.children.map(e=>e.className)).toEqual(['movement-button movement-left','combat-progression','movement-button movement-right']);
  for(const [index,direction]of ['left','right'].entries()){
    const button=strip.buttons[index] as unknown as Element;
    expect(button.attributes['aria-label']).toBe(`Move ${direction}`);expect(button.attributes['aria-pressed']).toBe('false');
    expect(button.type).toBe('button');expect(button.disabled).toBe(true);expect(button.draggable).toBe(false);
    expect(button.innerHTML).toContain('<svg');
    expect(button.innerHTML).toContain(`class="combat-keycue" aria-hidden="true">${index===0?'A':'D'}</span>`);
  }
  strip.dispose();expect(root.removed).toBe(true);
});
