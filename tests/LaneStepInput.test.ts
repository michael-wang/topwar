import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LaneStepInput } from '../src/input/LaneStepInput';

class Button extends EventTarget {
  disabled=false; captures=new Set<number>(); attrs:Record<string,string>={}; classes=new Set<string>();
  classList={add:(s:string)=>this.classes.add(s),remove:(s:string)=>this.classes.delete(s)};
  setAttribute(k:string,v:string){this.attrs[k]=v;}
  setPointerCapture(id:number){this.captures.add(id);}
  hasPointerCapture(id:number){return this.captures.has(id);}
  releasePointerCapture(id:number){this.captures.delete(id);}
}
function fixture() {
  const keys = new EventTarget();
  const doc=Object.assign(new EventTarget(),{hidden:false,activeElement:null});
  const viewport = Object.assign(new EventTarget(), { setPointerCapture: vi.fn(),
    ownerDocument:doc,
    getBoundingClientRect: () => ({ left: 20, width: 400 }) });
  const buttons=[new Button(),new Button()] as const;
  const step = vi.fn(() => true);
  const input = new LaneStepInput(viewport as unknown as HTMLElement, keys as unknown as Window, step,
    buttons as unknown as readonly [HTMLButtonElement,HTMLButtonElement]);
  input.start();
  const dispatch = (target: EventTarget, type: string, fields: object) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    return event;
  };
  const key = (type: string, key: string, repeat = false, target?: object) => dispatch(keys, type, { key, repeat, ...(target ? { target } : {}) });
  const pointer = (type: string, direction: -1 | 1, fields = {}) => dispatch(buttons[direction===-1?0:1], type,
    { pointerId: 1, pointerType: 'touch', ...fields });
  return { input, step, key, pointer, keys, buttons, viewport, doc, dispatch };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('sends an immediate lane step per physical key press and ignores OS repeat events', () => {
  const f = fixture();
  f.key('keydown', 'a');
  f.key('keydown', 'a', true);
  f.key('keydown', 'a');
  expect(f.step.mock.calls).toEqual([[-1]]);
  f.key('keyup', 'a');
  f.key('keydown', 'ArrowLeft');
  f.key('keyup', 'ArrowLeft');
  f.key('keydown', 'd');
  f.key('keyup', 'd');
  f.key('keydown', 'ArrowRight');
  expect(f.step.mock.calls).toEqual([[-1], [-1], [1], [1]]);
  f.input.dispose();
});

it('waits 180 ms then steps at 120 ms cadence regardless of OS repeat rate', () => {
  const f = fixture();
  f.key('keydown', 'ArrowRight');
  vi.advanceTimersByTime(179);
  for (let index = 0; index < 30; index++) f.key('keydown', 'ArrowRight', true);
  expect(f.step).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(f.step).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(119);
  expect(f.step).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(1);
  expect(f.step).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(240);
  expect(f.step).toHaveBeenCalledTimes(5);
  f.key('keyup', 'ArrowRight');
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(5);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it.each(['blur', 'stop', 'dispose'])('%s clears hold timers and restart cannot revive a hold', (cleanup) => {
  const f = fixture();
  f.key('keydown', 'a');
  vi.advanceTimersByTime(100);
  if (cleanup === 'blur') f.keys.dispatchEvent(new Event('blur'));
  else f.input[cleanup as 'stop' | 'dispose']();
  expect(vi.getTimerCount()).toBe(0);
  f.input.start(); // Same stop/start lifecycle used by Pause and Retry.
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(1);
  f.key('keydown', 'a');
  expect(f.step).toHaveBeenCalledTimes(2);
  f.input.dispose();
});

it('opposite press immediately takes over with a fresh delay and no stale timers', () => {
  const f = fixture();
  f.key('keydown', 'a');
  vi.advanceTimersByTime(100);
  f.key('keydown', 'd');
  f.key('keyup', 'a');
  vi.advanceTimersByTime(179);
  expect(f.step.mock.calls).toEqual([[-1], [1]]);
  vi.advanceTimersByTime(1);
  expect(f.step.mock.calls).toEqual([[-1], [1], [1]]);
  f.key('keyup', 'd');
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it('stops scheduling at an outer lane and can immediately step away from it', () => {
  const f = fixture();
  let lane = 2;
  f.step.mockImplementation((direction?: -1 | 1) => {
    lane = Math.max(0, Math.min(4, lane + direction!));
    return lane + direction! >= 0 && lane + direction! < 5;
  });
  f.key('keydown', 'd');
  vi.advanceTimersByTime(180);
  expect(lane).toBe(4);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(5000);
  expect(f.step).toHaveBeenCalledTimes(2);
  f.key('keydown', 'a');
  expect(lane).toBe(3);
  f.input.dispose();
});

it('entering an editable control cancels a hold and preserves native key editing', () => {
  const f = fixture();
  f.key('keydown', 'd');
  const event = new Event('focusin');
  const control = { closest: () => ({}) };
  Object.defineProperty(event, 'target', { value: control });
  f.keys.dispatchEvent(event);
  expect(f.key('keydown', 'ArrowRight', false, control).defaultPrevented).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it.each([-1,1] as const)('visible direction %i steps on press, holds at keyboard cadence, and stops immediately on release', direction => {
  const f = fixture();
  const button=f.buttons[direction===-1?0:1];
  expect(f.pointer('pointerdown', direction).defaultPrevented).toBe(true);
  expect(f.step.mock.calls).toEqual([[direction]]);expect(button.attrs['aria-pressed']).toBe('true');
  vi.advanceTimersByTime(179);expect(f.step).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);expect(f.step).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(240);expect(f.step).toHaveBeenCalledTimes(4);
  f.pointer('pointerup', direction);expect(button.attrs['aria-pressed']).toBe('false');expect(button.captures.size).toBe(0);
  vi.advanceTimersByTime(1000);expect(f.step).toHaveBeenCalledTimes(4);expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it('never steers from the old invisible viewport/bottom surface or pointer compatibility click', () => {
  const f = fixture();
  for(const type of ['pointerdown','pointerup'])f.dispatch(f.viewport,type,{pointerId:1,clientX:50,clientY:800});
  expect(f.step).not.toHaveBeenCalled();
  f.pointer('pointerdown',-1);f.pointer('pointerup',-1);
  f.dispatch(f.buttons[0],'click',{detail:1});expect(f.step.mock.calls).toEqual([[-1]]);
  f.dispatch(f.buttons[1],'click',{detail:0});expect(f.step.mock.calls).toEqual([[-1],[1]]);
  f.input.dispose();
});

it.each(['pointercancel','lostpointercapture','touchcancel','blur','hidden','focus','stop','dispose'])(
  '%s ends a button hold without stale repeat or pressed feedback', cleanup => {
    const f=fixture();f.pointer('pointerdown',-1);vi.advanceTimersByTime(100);
    if(['pointercancel','lostpointercapture','touchcancel'].includes(cleanup))f.pointer(cleanup,-1);
    else if(cleanup==='blur')f.keys.dispatchEvent(new Event('blur'));
    else if(cleanup==='hidden'){f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));}
    else if(cleanup==='focus')f.dispatch(f.keys,'focusin',{target:{closest:()=>({})}});
    else f.input[cleanup as 'stop'|'dispose']();
    expect(f.buttons[0].attrs['aria-pressed']).toBe('false');expect(f.buttons[0].captures.size).toBe(0);
    vi.advanceTimersByTime(1000);expect(f.step).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
    f.input.dispose();
  });
it('ignores second fingers and non-left mouse presses; fresh opposite press works after release',()=>{
  const f=fixture();f.pointer('pointerdown',1,{pointerType:'mouse',button:2});expect(f.step).not.toHaveBeenCalled();
  f.pointer('pointerdown',-1);f.pointer('pointerdown',1,{pointerId:2});
  f.pointer('pointerup',1,{pointerId:2});vi.advanceTimersByTime(180);
  expect(f.step.mock.calls).toEqual([[-1],[-1]]);
  f.pointer('pointerup',-1);f.pointer('pointerdown',1,{pointerId:2});expect(f.step.mock.lastCall).toEqual([1]);
  f.input.dispose();
});
it('reaches a lane edge without timer churn but retains held feedback until release',()=>{
  const f=fixture();let lane=2;
  f.step.mockImplementation((direction?:-1|1)=>{lane=Math.max(0,Math.min(4,lane+direction!));return lane>0&&lane<4;});
  f.pointer('pointerdown',1);vi.advanceTimersByTime(1000);
  expect(lane).toBe(4);expect(f.step).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
  expect(f.buttons[1].attrs['aria-pressed']).toBe('true');f.pointer('pointerup',1);
  expect(f.buttons[1].attrs['aria-pressed']).toBe('false');f.input.dispose();
});
it('prevents native mobile callout/selection/drag/touch defaults without another steering system',()=>{
  const f=fixture();
  for(const type of ['contextmenu','selectstart','dragstart','touchstart','touchmove'])
    expect(f.dispatch(f.buttons[0],type,{}).defaultPrevented).toBe(true);
  expect(f.step).not.toHaveBeenCalled();f.input.stop();
  f.dispatch(f.buttons[0],'click',{detail:0});f.pointer('pointerdown',-1);expect(f.step).not.toHaveBeenCalled();
  expect(f.buttons.every(b=>b.disabled)).toBe(true);f.input.dispose();
  expect(f.dispatch(f.buttons[0],'contextmenu',{}).defaultPrevented).toBe(false);
});
it('abandons a failed capture without moving or scheduling a stranded hold',()=>{
  const f=fixture();f.buttons[0].setPointerCapture=()=>{throw Error('canceled pointer');};
  f.pointer('pointerdown',-1);expect(f.step).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);f.input.dispose();
});

it('cleans up a non-cancelable browser touch cancellation without trying to prevent its default',()=>{
  const f=fixture();f.pointer('pointerdown',-1);
  const event=new Event('touchcancel',{cancelable:false});
  const prevent=vi.spyOn(event,'preventDefault');f.buttons[0].dispatchEvent(event);
  expect(prevent).not.toHaveBeenCalled();expect(f.buttons[0].attrs['aria-pressed']).toBe('false');
  vi.advanceTimersByTime(1000);expect(f.step).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});
