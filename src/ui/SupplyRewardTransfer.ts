import { grenadeIcon } from './GrenadeButton';
import type { GrenadeButton } from './GrenadeButton';
import type { GrenadeEvent } from '../simulation/grenade';

export const SUPPLY_TRANSFER = { delayMs: 90, staggerMs: 150, flightMs: 620, pulseMs: 180 };
export function supplyTransferPoint(t:number,origin:{x:number;y:number},target:{x:number;y:number},index:number,count:number,width:number,height:number) {
  const clamp=(v:number,max:number)=>Math.max(20,Math.min(max-20,v));
  const x0=clamp(origin.x,width),y0=clamp(origin.y,height),x3=clamp(target.x,width),y3=clamp(target.y,height);
  const spread=(index-(count-1)/2)*48,u=1-t;
  const x1=clamp(x0+spread,width),y1=clamp(y0-85,height);
  const x2=clamp(x3+spread*.6,width),y2=clamp(y3-95,height);
  return {x:u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
    y:u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3};
}

// Three reusable visual items. Inventory belongs exclusively to simulation.
export class SupplyRewardTransfer {
  private readonly layer=document.createElement('div');
  private readonly items=Array.from({length:3},()=>document.createElement('div'));
  private transfer:{atMs:number;x:number;z:number;count:number;arrived:number}|null=null;
  private lastArrivalMs=-Infinity;
  constructor(private readonly viewport:HTMLElement,private readonly button:GrenadeButton,
    private readonly project:(x:number,z:number,nowMs:number)=>{x:number;y:number}) {
    this.layer.className='supply-reward-transfer';this.layer.setAttribute('aria-hidden','true');
    for(const item of this.items){item.className='supply-reward-item';item.innerHTML=grenadeIcon;item.hidden=true;this.layer.append(item);}
    viewport.append(this.layer);
  }
  present(event:Extract<GrenadeEvent,{kind:'grenadeSupplyOpened'}>,nowMs:number):void {
    this.reset();this.transfer={atMs:nowMs,x:event.x,z:event.z,count:Math.min(3,event.amount),arrived:0};
    this.button.beginSupplyTransfer();
  }
  update(nowMs:number):void {
    const s=this.transfer;if(!s)return;
    const bounds=this.viewport.getBoundingClientRect(),dest=this.button.getBounds();
    const target={x:dest.x+dest.width/2-bounds.x,y:dest.y+dest.height/2-bounds.y};
    const origin=this.project(s.x,s.z,s.atMs),c=SUPPLY_TRANSFER;
    let arrived=0;
    for(let i=0;i<this.items.length;i++) {
      const age=nowMs-s.atMs-c.delayMs-i*c.staggerMs,t=age/c.flightMs,item=this.items[i];
      item.hidden=i>=s.count||t<0||t>=1;
      if(i<s.count&&t>=1)arrived++;
      if(item.hidden)continue;
      const p=supplyTransferPoint(t,origin,target,i,s.count,bounds.width,bounds.height);
      const scale=.65+.35*Math.sin(Math.PI*Math.min(1,t*2));
      item.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) rotate(${(i%2?1:-1)*18*Math.sin(t*Math.PI)}deg) scale(${scale})`;
    }
    if(arrived>s.arrived){s.arrived=arrived;this.lastArrivalMs=nowMs;}
    const pulse=Math.max(0,1-(nowMs-this.lastArrivalMs)/c.pulseMs);
    const growth=s.count===3 ? .82+.18*Math.min(1,(nowMs-s.atMs)/(c.delayMs+2*c.staggerMs+c.flightMs)) : 1;
    this.button.presentSupplyTransfer(growth+pulse*(s.count===3?.1:.06),pulse);
    if(s.arrived===s.count&&pulse===0)this.reset();
  }
  reset():void {this.transfer=null;this.lastArrivalMs=-Infinity;for(const item of this.items)item.hidden=true;this.button.endSupplyTransfer();}
  dispose():void {this.reset();this.layer.remove();}
}
