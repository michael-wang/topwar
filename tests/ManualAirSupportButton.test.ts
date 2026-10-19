import { expect, it, vi } from 'vitest';
import { ManualAirSupportButton } from '../src/ui/ManualAirSupportButton';
import { createPlaytestScenario } from '../src/app/PlaytestScenarios';
import config from './helpers/ShippingConfig';
import levelData from '../public/game-data/levels/level-001.json';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
class ElementStub extends EventTarget {
  type = ''; className = ''; title = ''; innerHTML = ''; hidden = true; disabled = true;
  style = { cssText: '', display: '', opacity: '', transform: '', boxShadow: '', filter: '' }; attrs: Record<string, string> = {}; remove = vi.fn(); append = vi.fn();
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  children = new Map<string, ElementStub>();
  querySelector(key: string) { if (!this.children.has(key)) this.children.set(key, new ElementStub()); return this.children.get(key)!; }
}
it('uses native click activation, gates readiness/playing state and latches repeated activation immediately', () => {
  vi.stubGlobal('document', { createElement: () => new ElementStub() });
  try {
    const call = vi.fn(() => true), control = new ManualAirSupportButton(new ElementStub() as unknown as HTMLElement, call);
    const button = control.element as unknown as ElementStub;
    const sim = createPlaytestScenario({ seed: 17, level: LevelDefinitionSchema.parse(levelData), startSquad: 1, startRocketCount: 0, tiers: config.tiers,
      catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } }, 27, 'air-support');
    const s = sim.getState(); control.update(s, true); expect(button.hidden).toBe(true);
    s.commanderSupport!.airstrike!.manual = { availableAtSeconds: 60, announcementAtSeconds: 60, ready: true };
    control.update(s, false); expect(button.hidden).toBe(false); expect(button.disabled).toBe(true);
    button.dispatchEvent(new Event('click')); expect(call).not.toHaveBeenCalled();
    control.update(s, true); expect(button.attrs['aria-label']).toBe('呼叫空襲'); expect(button.type).toBe('button');
    button.dispatchEvent(new Event('click')); button.dispatchEvent(new Event('click')); expect(call).toHaveBeenCalledOnce();
    const pointer = new Event('pointerdown'), stop = vi.spyOn(pointer, 'stopPropagation'); button.dispatchEvent(pointer); expect(stop).toHaveBeenCalledOnce();
    s.commanderSupport!.airstrike!.status = 'waiting'; control.update(s, true); expect(button.hidden).toBe(true);
    s.commanderSupport!.airstrike!.status = 'ready'; s.defenseTank!.status = 'defeated'; control.update(s, true); expect(button.hidden).toBe(true);
    control.reset(); expect(button.disabled).toBe(true); control.dispose(); expect(button.remove).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});

it.each([false,true])('bounds the READY cue on the pause-aware clock, suppresses restored awards (reduced motion %s)',reduced=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});vi.stubGlobal('matchMedia',()=>({matches:reduced}));
  try{
    const control=new ManualAirSupportButton(new ElementStub() as unknown as HTMLElement,()=>true),button=control.element as unknown as ElementStub;
    const s=createPlaytestScenario({seed:17,level:LevelDefinitionSchema.parse(levelData),startSquad:1,startRocketCount:0,tiers:config.tiers,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},27,'air-support').getState();
    control.update(s,true,100);s.commanderSupport!.airstrike!.manual={availableAtSeconds:60,announcementAtSeconds:60,ready:true};
    control.update(s,true,200);const ring=button.querySelector('i'),icon=button.querySelector('svg');expect(Number(ring.style.opacity)).toBe(.95);expect(icon.style.filter).toContain('brightness(2)');expect(button.innerHTML).not.toContain('空襲就緒');expect(button.innerHTML).not.toContain('<em');
    const motes=button.append.mock.calls.slice(0, 8).map(([mote])=>mote as ElementStub);expect(motes).toHaveLength(8);const initialMotes=motes.map(m=>m.style.transform);
    control.update(s,true,600);if(reduced)expect(motes.map(m=>m.style.transform)).toEqual(initialMotes);else expect(motes.map(m=>m.style.transform)).not.toEqual(initialMotes);const paused={...ring.style};control.update(s,false,600);expect(ring.style).toEqual(paused);expect(button.disabled).toBe(true);
    if(reduced)expect(ring.style.transform).toBe('scale(1.15)');else expect(ring.style.transform).not.toBe('scale(1.15)');
    control.update(s,true,1000);expect(ring.style.opacity).toBe('0');
    control.update(s,true,2000);expect(ring.style.opacity).toBe('0');
    control.restore(s);control.update(s,true,0);expect(button.hidden).toBe(false);expect(ring.style.opacity).toBe('0');expect(ring.style.opacity).toBe('0');
    control.reset();control.update(s,true,0);expect(ring.style.opacity).toBe('0.95');
    s.commanderSupport!.airstrike!.status='waiting';control.update(s,true,10);expect(button.hidden).toBe(true);expect(ring.style.opacity).toBe('0');
    expect(button.innerHTML).toContain('>1</strong>');control.dispose();
  }finally{vi.unstubAllGlobals();}
});

it('previews the same disabled button during the selected announcement and retains the hint only until use', () => {
  vi.stubGlobal('document', { createElement: () => new ElementStub() });
  try {
    const call=vi.fn(()=>true), control=new ManualAirSupportButton(new ElementStub() as unknown as HTMLElement,call);
    const s=createPlaytestScenario({seed:17,level:LevelDefinitionSchema.parse(levelData),startSquad:1,startRocketCount:0,tiers:config.tiers,catharsis:{balance:config.catharsis!,trackHalfWidth:config.track.halfWidth}},27,'air-support').getState();
    s.commanderSupport!.airstrike!.manual={availableAtSeconds:60,announcementAtSeconds:60,ready:false};
    const button=control.element as unknown as ElementStub, hint=button.append.mock.calls.at(-1)![0] as ElementStub;
    control.update(s,true,100,true);expect(button.hidden).toBe(false);expect(button.disabled).toBe(true);expect(hint.hidden).toBe(false);
    button.dispatchEvent(new Event('click'));expect(call).not.toHaveBeenCalled();expect(button.querySelector('i').style.opacity).toBe('0');
    control.update(s,true,150,false);expect(button.hidden).toBe(false);expect(button.disabled).toBe(true);
    s.commanderSupport!.airstrike!.manual!.ready=true;control.update(s,true,200,false);expect(control.element).toBe(button);expect(button.disabled).toBe(false);
    control.update(s,true,2000);expect(hint.hidden).toBe(false);expect(button.querySelector('i').style.opacity).toBe('0');
    button.dispatchEvent(new Event('click'));s.commanderSupport!.airstrike!.status='waiting';control.update(s,true,2010);expect(button.hidden).toBe(true);expect(hint.hidden).toBe(true);
    control.restore(s);expect(hint.hidden).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
