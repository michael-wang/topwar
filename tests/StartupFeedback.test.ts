import {afterEach,expect,it,vi} from 'vitest';
import {startupFailure,startupResource,startupStatus} from '../src/ui/StartupFeedback';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('bounds stalled resources and clears its deadline after success or failure',async()=>{
  vi.useFakeTimers();
  expect(await startupResource(Promise.resolve(7))).toBe(7);expect(vi.getTimerCount()).toBe(0);
  await expect(startupResource(Promise.reject(new Error('offline')))).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);
  const pending=startupResource(new Promise(()=>{})),failure=expect(pending).rejects.toThrow('Startup resource timed out');
  await vi.advanceTimersByTimeAsync(30000);await failure;expect(vi.getTimerCount()).toBe(0);
});

class Node extends EventTarget {
  children:Node[]=[];textContent='';className='';lang='';type='';disabled=false;inert=false;
  attrs=new Map<string,string>();focus=vi.fn();
  setAttribute(k:string,v:string){this.attrs.set(k,v);}
  append(...nodes:Node[]){this.children.push(...nodes);}
  replaceChildren(...nodes:Node[]){this.children=nodes;}
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
it('updates only the boot status, leaving an existing recovery chooser untouched',()=>{
  const status=new Node(),query=vi.fn().mockReturnValueOnce(status).mockReturnValueOnce(null);
  vi.stubGlobal('document',{querySelector:query});startupStatus('正在準備角色與戰場…');
  expect(status.textContent).toBe('正在準備角色與戰場…');startupStatus('next');expect(status.textContent).toBe('正在準備角色與戰場…');
});
