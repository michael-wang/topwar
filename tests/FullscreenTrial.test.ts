import {afterEach,expect,it,vi} from 'vitest';
import {FullscreenTrial} from '../src/dev/FullscreenTrial';
class Node extends EventTarget {
  children:Node[]=[];textContent='';className='';type='';disabled=false;removed=false;style={cssText:''};
  setAttribute(){} append(...children:Node[]){this.children.push(...children);} remove(){this.removed=true;}
}
function setup(supported=true){
  const host=new Node(),viewport=new Node(),doc=Object.assign(new EventTarget(),{fullscreenEnabled:true,fullscreenElement:null as Node|null,createElement:()=>new Node(),exitFullscreen:vi.fn(async()=>{})});
  const enter=vi.fn(async()=>{});if(supported)Object.assign(viewport,{requestFullscreen:enter});
  vi.stubGlobal('document',doc);vi.stubGlobal('isSecureContext',false);
  const trial=new FullscreenTrial(host as unknown as HTMLElement,viewport as unknown as HTMLElement);
  const [button,status]=host.children[0].children;
  return {host,viewport,doc,enter,trial,button,status};
}
afterEach(()=>vi.unstubAllGlobals());
it('requests directly in the user event, ignores repeated pending input, tracks enter/exit/re-entry and browser exit',async()=>{
  const {viewport,doc,enter,trial,button,status}=setup();
  expect(enter).not.toHaveBeenCalled();
  button.dispatchEvent(new Event('click'));expect(enter).toHaveBeenCalledOnce();expect(enter).toHaveBeenCalledWith({navigationUI:'hide'});expect(button.disabled).toBe(true);
  button.dispatchEvent(new Event('click'));expect(enter).toHaveBeenCalledOnce();
  doc.fullscreenElement=viewport;doc.dispatchEvent(new Event('fullscreenchange'));
  expect(status.textContent).toContain('ON');expect(button.textContent).toBe('離開全螢幕（DEV）');
  await Promise.resolve();button.dispatchEvent(new Event('click'));expect(doc.exitFullscreen).toHaveBeenCalledOnce();
  doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));await Promise.resolve();
  button.dispatchEvent(new Event('click'));expect(enter).toHaveBeenCalledTimes(2);await Promise.resolve();
  doc.fullscreenElement=viewport;doc.dispatchEvent(new Event('fullscreenchange'));doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));
  expect(status.textContent).toContain('OFF');expect(button.disabled).toBe(false);
  trial.dispose();const text=status.textContent;doc.fullscreenElement=viewport;doc.dispatchEvent(new Event('fullscreenchange'));
  expect(status.textContent).toBe(text);expect(button.disabled).toBe(false);
});
it('recovers rejected and synchronous requests without blocking ordinary play or future attempts',async()=>{
  const {doc,enter,trial,button,status}=setup();enter.mockRejectedValueOnce(new Error('denied'));
  button.dispatchEvent(new Event('click'));await Promise.resolve();expect(button.disabled).toBe(false);expect(status.textContent).toContain('一般視窗繼續遊戲');
  enter.mockImplementationOnce(()=>{throw new Error('denied')});button.dispatchEvent(new Event('click'));expect(button.disabled).toBe(false);
  doc.dispatchEvent(new Event('fullscreenerror'));expect(status.textContent).toContain('請求未成功');
  button.dispatchEvent(new Event('click'));expect(enter).toHaveBeenCalledTimes(3);await Promise.resolve();trial.dispose();
});
it('reports unsupported environments without calling an API or creating an activation barrier',()=>{
  const {button,status,enter,trial}=setup(false);expect(button.disabled).toBe(true);expect(status.textContent).toContain('不支援');
  button.dispatchEvent(new Event('click'));expect(enter).not.toHaveBeenCalled();trial.dispose();
});
