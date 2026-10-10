import { goldenGrenadeIcon } from '../art/GoldenGrenade';
import type { GrenadeButton } from './GrenadeButton';
import type { GrenadeEvent } from '../simulation/grenade';

export const SUPPLY_TRANSFER = { delayMs: 90, staggerMs: 360, flightMs: 900, pulseMs: 180, peakSize: 108 };
export function supplyTransferScale(t:number,iconSize=36):number {
  const smooth=(v:number)=>v*v*(3-2*v);
  if(t<.18)return .45+.55*smooth(Math.max(0,t/.18));
  return 1-(1-iconSize/SUPPLY_TRANSFER.peakSize)*smooth(Math.max(0,Math.min(1,(t-.42)/.58)));
}
export function supplyTransferPoint(t:number,origin:{x:number;y:number},target:{x:number;y:number},index:number,count:number,width:number,height:number,iconSize=36) {
  const clamp=(v:number,max:number)=>Math.max(20,Math.min(max-20,v));
  const x0=clamp(origin.x,width),y0=clamp(origin.y,height),x3=clamp(target.x,width),y3=clamp(target.y,height);
  const spread=(count===1?55:index*125)*(x0<width/2?1:-1),u=1-t;
  const x1=clamp(x0+spread,width),y1=clamp(y0-105,height);
  const x2=clamp(x3+spread*.65,width),y2=clamp(y3-95,height);
  // Include the rotated silhouette and shadow, not just its center, in edge bounds.
  const margin=SUPPLY_TRANSFER.peakSize*supplyTransferScale(t,iconSize)*.57+4;
  const contain=(v:number,max:number)=>Math.max(margin,Math.min(max-margin,v));
  return {x:contain(u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,width),
    y:contain(u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3,height)};
}

// Three reusable visual items. Inventory belongs exclusively to simulation.
export class SupplyRewardTransfer {
  private readonly layer=document.createElement('div');
  private readonly items=Array.from({length:3},()=>document.createElement('div'));
  private transfer:{atMs:number;x:number;z:number;count:number;arrived:number}|null=null;
  private lastArrivalMs=-Infinity;
  private bounds: {width:number;height:number;cx:number;cy:number;dx:number;dy:number;iconSize:number;origin:{x:number;y:number}}|null=null;
  private buttonScale=1;
  private readonly invalidate=():void=>{this.bounds=null;};
  private readonly resizeObserver=new ResizeObserver(this.invalidate);
  private readonly styleObserver=new MutationObserver(this.invalidate);
  constructor(private readonly viewport:HTMLElement,private readonly button:GrenadeButton,
    private readonly project:(x:number,z:number,nowMs:number)=>{x:number;y:number}) {
    this.layer.className='supply-reward-transfer';this.layer.setAttribute('aria-hidden','true');
    for(const item of this.items){item.className='supply-reward-item';item.innerHTML=goldenGrenadeIcon;item.hidden=true;this.layer.append(item);}
    viewport.append(this.layer);
    this.resizeObserver.observe(viewport);
    this.styleObserver.observe(viewport,{attributes:true,attributeFilter:['style','class']});
    window.addEventListener('resize',this.invalidate);
    window.visualViewport?.addEventListener('resize',this.invalidate);
  }
  present(event:Extract<GrenadeEvent,{kind:'grenadeSupplyOpened'}>,nowMs:number):void {
    this.reset();this.transfer={atMs:nowMs,x:event.x,z:event.z,count:Math.min(3,event.amount),arrived:0};
    this.button.beginSupplyTransfer();
  }
  update(nowMs:number):void {
    const s=this.transfer;if(!s)return;
    // Measure only on entry/resize, before this frame's style writes. Recover
    // unscaled geometry if a resize occurs during the existing button pulse.
    if(!this.bounds){
      const viewport=this.viewport.getBoundingClientRect(),icon=this.button.getIconBounds(),button=this.button.getBounds();
      const cx=button.x+button.width/2,cy=button.y+button.height/2;
      this.bounds={width:viewport.width,height:viewport.height,cx:cx-viewport.x,cy:cy-viewport.y,
        dx:(icon.x+icon.width/2-cx)/this.buttonScale,dy:(icon.y+icon.height/2-cy)/this.buttonScale,
        iconSize:icon.width/this.buttonScale,origin:this.project(s.x,s.z,s.atMs)};
    }
    const c=SUPPLY_TRANSFER;
    let arrived=0;
    for(let i=0;i<s.count;i++)if(nowMs-s.atMs-c.delayMs-i*c.staggerMs>=c.flightMs)arrived++;
    if(arrived>s.arrived){s.arrived=arrived;this.lastArrivalMs=nowMs;}
    const pulse=Math.max(0,1-(nowMs-this.lastArrivalMs)/c.pulseMs);
    const growth=s.count===3 ? .82+.18*Math.min(1,(nowMs-s.atMs)/(c.delayMs+2*c.staggerMs+c.flightMs)) : 1;
    this.buttonScale=growth+pulse*(s.count===3?.1:.06);
    this.button.presentSupplyTransfer(this.buttonScale,pulse);
    const bounds=this.bounds,iconSize=bounds.iconSize*this.buttonScale;
    const target={x:bounds.cx+bounds.dx*this.buttonScale,y:bounds.cy+bounds.dy*this.buttonScale};
    const origin=bounds.origin;
    for(let i=0;i<this.items.length;i++) {
      const age=nowMs-s.atMs-c.delayMs-i*c.staggerMs,t=age/c.flightMs,item=this.items[i];
      item.hidden=i>=s.count||t<0||t>=1;
      if(item.hidden)continue;
      const p=supplyTransferPoint(t,origin,target,i,s.count,bounds.width,bounds.height,iconSize);
      const scale=supplyTransferScale(t,iconSize);
      item.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${(i%2?1:-1)*8*Math.sin(t*Math.PI)}deg) scale(${scale})`;
    }
    if(s.arrived===s.count&&pulse===0)this.reset();
  }
  reset():void {this.transfer=null;this.bounds=null;this.buttonScale=1;this.lastArrivalMs=-Infinity;for(const item of this.items)item.hidden=true;this.button.endSupplyTransfer();}
  dispose():void {this.reset();this.resizeObserver.disconnect();this.styleObserver.disconnect();window.removeEventListener('resize',this.invalidate);window.visualViewport?.removeEventListener('resize',this.invalidate);this.layer.remove();}
}
