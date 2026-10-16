import { checkpointPresent } from '../app/SessionCheckpoint';
import type { WakeStatus } from '../app/ScreenWakeLock';
import { FullscreenTrial } from '../dev/FullscreenTrial';

export class QaPanel {
  readonly element=document.createElement('details');
  private readonly status=document.createElement('p');
  private readonly wake=document.createElement('p');
  private readonly saved=document.createElement('p');
  private readonly confirmation=document.createElement('div');
  private pending:(()=>void)|null=null;
  private locked=false;
  private readonly buttons:HTMLButtonElement[]=[];
  private readonly fullscreen:FullscreenTrial|null;
  private readonly stop=(e:Event)=>e.stopPropagation();
  constructor(host:HTMLElement,actions:{sleep:()=>void;reload:()=>void;exit:()=>void},fullscreenViewport?:HTMLElement) {
    this.element.className='qa-panel';
    const summary=document.createElement('summary');summary.textContent='熄屏與存檔 QA';
    summary.style.cssText='min-height:44px;width:100%;box-sizing:border-box;padding:10px;font-size:13px';
    const content=document.createElement('div');content.className='qa-panel-content';
    content.style.cssText='padding:8px;font:13px/1.45 sans-serif';
    const title=document.createElement('strong');title.textContent='測試工具・非一般遊戲功能';
    const initial=document.createElement('p');
    const nav=performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming|undefined;
    const discarded=(document as Document&{wasDiscarded?:boolean}).wasDiscarded;
    initial.textContent=`導覽：${nav?.type??'unknown'}・Discard：${discarded===undefined?'unknown':String(discarded)}`;
    content.append(title,this.wake,this.saved,initial,this.status);
    this.fullscreen=fullscreenViewport?new FullscreenTrial(content,fullscreenViewport):null;
    const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;
      b.style.cssText='min-height:44px;width:100%;margin:4px 0;padding:6px;touch-action:manipulation';
      b.addEventListener('click',()=>{if(!this.locked)fn();});this.buttons.push(b);content.append(b);return b;};
    button('15 秒熄屏 / Resume 測試',()=>this.confirm(()=>{this.locked=true;this.status.textContent='正在準備 AHEAD Lv10 高負載場景…';actions.sleep();}));
    button('重新載入恢復測試',()=>this.confirm(actions.reload));
    button('結束測試（保持暫停）',actions.exit);
    button('關閉工具',()=>{this.element.open=false;});
    this.confirmation.hidden=true;this.confirmation.setAttribute('role','group');
    const message=document.createElement('p');message.textContent='測試可能替換目前遊戲及已儲存進度。確定繼續？';
    const yes=document.createElement('button');yes.type='button';yes.textContent='確認開始測試';
    yes.addEventListener('click',()=>{const pending=this.pending;this.pending=null;this.confirmation.hidden=true;pending?.();});
    const no=document.createElement('button');no.type='button';no.textContent='取消';no.addEventListener('click',()=>{this.pending=null;this.confirmation.hidden=true;});
    this.confirmation.append(message,yes,no);content.append(this.confirmation);
    this.element.append(summary,content);host.append(this.element);
    this.element.addEventListener('pointerdown',this.stop);this.element.addEventListener('keydown',this.stop);
    this.element.addEventListener('toggle',()=>this.refreshCheckpoint());this.refreshCheckpoint();
  }
  private confirm(action:()=>void):void {this.pending=action;this.confirmation.hidden=false;}
  setStatus(text:string,busy=false):void {this.status.textContent=text;this.status.setAttribute('role','status');
    this.locked=busy;for(const b of this.buttons)b.disabled=busy;this.refreshCheckpoint();}
  setWake(status:WakeStatus):void {this.wake.textContent=`Wake Lock: ${{active:'ACTIVE',released:'RELEASED',requesting:'REQUESTING',releasing:'RELEASING',insecure:'UNSUPPORTED — INSECURE ORIGIN',unsupported:'UNSUPPORTED',error:'DENIED / ERROR'}[status]}`;}
  refreshCheckpoint():void {this.saved.textContent=`儲存進度：${checkpointPresent()?'AVAILABLE':'EMPTY / UNAVAILABLE'}`;}
  open():void {this.element.open=true;this.refreshCheckpoint();}
  dispose():void {this.fullscreen?.dispose();this.element.remove();}
}
