import {afterEach,expect,it,vi} from 'vitest';
import {startupFailure,startupLoading,startupPaint,startupResource,startupStatus} from '../src/ui/StartupFeedback';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('bounds stalled resources and clears its deadline after success or failure',async()=>{
  vi.useFakeTimers();
  expect(await startupResource(Promise.resolve(7))).toBe(7);expect(vi.getTimerCount()).toBe(0);
  await expect(startupResource(Promise.reject(new Error('offline')))).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);
  const pending=startupResource(new Promise(()=>{})),failure=expect(pending).rejects.toThrow('Startup resource timed out');
  await vi.advanceTimersByTimeAsync(30000);await failure;expect(vi.getTimerCount()).toBe(0);
});

class Node extends EventTarget {
  children:Node[]=[];textContent='';className='';lang='';type='';disabled=false;inert=false;value=0;max=0;
  attrs=new Map<string,string>();focus=vi.fn();
  setAttribute(k:string,v:string){this.attrs.set(k,v);}
  append(...nodes:Node[]){this.children.push(...nodes);}
  replaceChildren(...nodes:Node[]){this.children=nodes;}
  querySelector(selector:string):Node|null {
    const attr=selector.slice(1,-1);
    for(const child of this.children) { if(child.attrs.has(attr))return child;const found=child.querySelector(selector);if(found)return found; }
    return null;
  }
}
it('shows one accessible failure with a repeat-safe Reload action and keeps the game inert',()=>{
  const cover=new Node(),host=new Node(),reload=vi.fn(),ready=vi.fn();
  const doc=Object.assign(new EventTarget(),{getElementById:()=>cover,createElement:()=>new Node()});
  doc.addEventListener('topwar:boot-ready',ready);vi.stubGlobal('document',doc);vi.stubGlobal('location',{reload});
  startupFailure(host as unknown as HTMLElement);
  expect(ready).toHaveBeenCalledOnce();expect(host.inert).toBe(true);expect(cover.children).toHaveLength(1);
  const [title,status,hint,retry]=cover.children[0].children;
  expect(title.textContent).toBe('TOPWAR');expect(status.attrs.get('role')).toBe('alert');
  expect(hint.textContent).toContain('進度會保留');expect(cover.attrs.get('aria-busy')).toBe('false');
  expect(retry.focus).toHaveBeenCalledOnce();retry.dispatchEvent(new Event('click'));retry.dispatchEvent(new Event('click'));
  expect(reload).toHaveBeenCalledOnce();expect(retry.disabled).toBe(true);
});
it('counts completed milestones without advancing on elapsed time, and rejoins recovery without overwriting the choice',async()=>{
  vi.useFakeTimers();
  const cover=new Node(),host=new Node();cover.className='session-recovery';
  const chooser=new Node();chooser.textContent='繼續上次遊戲';cover.append(chooser);
  vi.stubGlobal('document',{getElementById:()=>cover,createElement:()=>new Node(),
    querySelector:()=>cover.className.split(' ').includes('boot-cover')?cover:null});
  startupStatus('正在讀取遊戲設定…',0);
  startupStatus('正在準備角色與戰場…',1);
  expect(cover.children).toEqual([chooser]); // Work may finish before the player chooses.
  startupLoading(host as unknown as HTMLElement,true);
  expect(cover.className).toBe('session-recovery boot-cover'); // Remains a blocking recovery dialog until ready.
  const [title,status,bar,step,hint]=cover.children[0].children;
  expect(host.inert).toBe(true);expect(title.textContent).toBe('TOPWAR');
  expect(hint.textContent).toContain('恢復');expect(status.textContent).toBe('正在準備角色與戰場…');
  expect(bar.max).toBe(4);expect(bar.value).toBe(1);expect(step.textContent).toBe('已完成 1 / 4 階段');
  await vi.advanceTimersByTimeAsync(20000);expect(bar.value).toBe(1);
  for(const [completed,text]of [[2,'正在建立戰場…'],[3,'正在完成準備…'],[4,'即將開始']]as const){
    startupStatus(text,completed);expect(bar.value).toBe(completed);
    expect(bar.attrs.get('aria-valuetext')).toBe(`已完成 ${completed} / 4 個準備階段`);
    expect(status.textContent).toBe(text);
  }
  startupLoading(host as unknown as HTMLElement,false);
  expect(cover.children[0].children[4].textContent).toContain('開始');
  expect(cover.children[0].children[2].value).toBe(4); // No pretend restart of completed work.
});

it('yields a paint opportunity without leaving timers or stalling in a hidden tab',async()=>{
  vi.useFakeTimers();const cancel=vi.fn();let paint:FrameRequestCallback|undefined;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{paint=callback;return 7;});
  vi.stubGlobal('cancelAnimationFrame',cancel);
  const visible=startupPaint();paint!(0);await vi.advanceTimersByTimeAsync(0);await visible;
  expect(vi.getTimerCount()).toBe(0);expect(cancel).toHaveBeenLastCalledWith(7);
  const hidden=startupPaint();await vi.advanceTimersByTimeAsync(100);await hidden;
  expect(vi.getTimerCount()).toBe(0);
});
