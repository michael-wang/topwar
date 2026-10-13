import { afterEach,expect,it,vi } from 'vitest';
import { QaPanel } from '../src/ui/QaPanel';
class Node extends EventTarget {
  children:Node[]=[];textContent='';innerHTML='';className='';hidden=false;open=false;disabled=false;
  style={cssText:''};
  classList={add:vi.fn()};attrs=new Map<string,string>();
  constructor(readonly tagName:string){super();}
  append(...nodes:Node[]){this.children.push(...nodes);}
  setAttribute(k:string,v:string){this.attrs.set(k,v);}
  remove(){}
}
afterEach(()=>vi.unstubAllGlobals());
it('uses a nested DEV QA section and confirmation, with no tuning inputs or duplicate actions',()=>{
  vi.stubGlobal('document',{createElement:(tag:string)=>new Node(tag)});
  const host=new Node('div'),sleep=vi.fn(),reload=vi.fn(),exit=vi.fn();
  const panel=new QaPanel(host as unknown as HTMLElement,{sleep,reload,exit});
  const root=host.children[0],summary=root.children[0],content=root.children[1];
  expect(summary.textContent).toBe('熄屏與存檔 QA'); expect(root.open).toBe(false);
  const all=(n:Node):Node[]=>[n,...n.children.flatMap(all)],nodes=all(root);
  expect(nodes.some(n=>['input','select','textarea'].includes(n.tagName))).toBe(false);
  const find=(text:string)=>nodes.find(n=>n.tagName==='button'&&n.textContent===text)!;
  find('15 秒熄屏 / Resume 測試').dispatchEvent(new Event('click'));expect(sleep).not.toHaveBeenCalled();
  find('取消').dispatchEvent(new Event('click'));find('確認開始測試').dispatchEvent(new Event('click'));expect(sleep).not.toHaveBeenCalled();
  find('15 秒熄屏 / Resume 測試').dispatchEvent(new Event('click'));find('確認開始測試').dispatchEvent(new Event('click'));
  find('確認開始測試').dispatchEvent(new Event('click'));expect(sleep).toHaveBeenCalledTimes(1);
  panel.setWake('active');expect(content.children.some(n=>n.textContent==='Wake Lock: ACTIVE')).toBe(true);
  panel.setStatus('已暫停');find('結束測試（保持暫停）').dispatchEvent(new Event('click'));expect(exit).toHaveBeenCalledTimes(1);
  panel.dispose();
});
