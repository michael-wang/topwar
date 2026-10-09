import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {SupplyRewardTransfer,supplyTransferPoint} from '../src/ui/SupplyRewardTransfer';
import {GrenadeRenderer} from '../src/rendering/GrenadeRenderer';
import type {GrenadeButton} from '../src/ui/GrenadeButton';
class Element {
  className='';innerHTML='';hidden=false;children:Element[]=[];
  style={transform:''};setAttribute=vi.fn();remove=vi.fn();append(e:Element){this.children.push(e);}
  getBoundingClientRect(){return{x:0,y:0,width:350,height:844};}
}
afterEach(()=>vi.unstubAllGlobals());
it('uses exactly three pooled items, staggered arrivals, frozen presentation time and responsive destinations',()=>{
  vi.stubGlobal('document',{createElement:()=>new Element()});const viewport=new Element();
  const button={getBounds:()=>({x:20,y:680,width:64,height:64}),beginSupplyTransfer:vi.fn(),presentSupplyTransfer:vi.fn(),endSupplyTransfer:vi.fn()};
  const transfer=new SupplyRewardTransfer(viewport as unknown as HTMLElement,button as unknown as GrenadeButton,()=>({x:175,y:400}));
  const items=viewport.children[0].children;
  transfer.present({kind:'grenadeSupplyOpened',x:0,z:14,amount:3},0);
  transfer.update(100);expect(items.filter(i=>!i.hidden)).toHaveLength(1);
  transfer.update(400);expect(items.filter(i=>!i.hidden)).toHaveLength(3);
  expect(new Set(items.map(i=>i.style.transform)).size).toBe(3);
  const frozen=items.map(i=>i.style.transform);transfer.update(400);expect(items.map(i=>i.style.transform)).toEqual(frozen);
  transfer.update(715);expect(items.filter(i=>!i.hidden)).toHaveLength(2);
  transfer.update(865);expect(items.filter(i=>!i.hidden)).toHaveLength(1);
  transfer.update(1015);expect(items.filter(i=>!i.hidden)).toHaveLength(0);
  transfer.update(1200);expect(button.endSupplyTransfer).toHaveBeenCalled();
  transfer.present({kind:'grenadeSupplyOpened',x:0,z:14,amount:1},1300);transfer.update(1700);
  expect(items.filter(i=>!i.hidden)).toHaveLength(1);expect(viewport.children[0].children).toBe(items);
  transfer.reset();expect(items.every(i=>i.hidden)).toBe(true);transfer.dispose();
});
it('keeps every curve inside the viewport, with its final position at the actual HUD center',()=>{
  for(const width of [350,390])for(const inset of [0,34])for(let i=0;i<3;i++) {
    const target={x:52,y:712-inset};
    for(let tick=0;tick<=100;tick++) {
      const p=supplyTransferPoint(tick/100,{x:width-5,y:400},target,i,3,width,844);
      expect(p.x).toBeGreaterThanOrEqual(20);expect(p.x).toBeLessThanOrEqual(width-20);
      expect(p.y).toBeGreaterThanOrEqual(20);expect(p.y).toBeLessThanOrEqual(824);
    }
    expect(supplyTransferPoint(1,{x:width-5,y:400},target,i,3,width,844)).toEqual(target);
  }
});
it('restores visibly distinct crate stages without replaying damage, and resets a final opening',()=>{
  const scene=new THREE.Scene(),renderer=new GrenadeRenderer(scene);
  const supply=scene.getObjectByName('grenade-supply')!,lid=supply.children[9],strap=supply.getObjectByName('crate-retaining-strap')!;
  const angles:number[]=[];
  for(const stage of [0,1,2] as const){renderer.update({originZ:0,elapsedSeconds:0,flight:null,
    supply:{lane:2,x:0,depth:14,destruction:{mode:'staged',stage,recoverySeconds:.7,recoverAtSeconds:stage?.7:0}}},0);
    angles.push(Math.abs(strap.rotation.z));expect(lid.position.y).toBe(.48);}
  expect(angles[1]).toBeGreaterThan(angles[0]);expect(angles[2]).toBeGreaterThan(angles[1]);
  renderer.present([{kind:'grenadeSupplyOpened',x:1.4,z:14,amount:3}],0);
  renderer.update({originZ:0,elapsedSeconds:0,supply:null,flight:null},100);
  expect(supply.visible).toBe(true);expect(supply.position.x).toBe(-1.4);
  renderer.reset();renderer.update({originZ:0,elapsedSeconds:0,supply:null,flight:null},100);expect(supply.visible).toBe(false);
  renderer.dispose();expect(scene.children).toEqual([]);
});
