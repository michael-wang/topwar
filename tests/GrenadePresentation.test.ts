import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { GrenadeRenderer } from '../src/rendering/GrenadeRenderer';
import { GrenadeButton } from '../src/ui/GrenadeButton';
import type { GameRenderState } from '../src/rendering/RenderState';

it('pulses the existing crate on a hit, freezes with presentation time and resets without resources',()=>{
  const scene=new THREE.Scene(),renderer=new GrenadeRenderer(scene);
  const state={supply:{lane:2,x:0,depth:14,hitsRequired:10,hitProgress:1},flight:null,originZ:0,elapsedSeconds:1};
  const supply=scene.getObjectByName('grenade-supply')!;
  const crate=supply.children[0] as THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>;
  const children=[...scene.children];renderer.present([{kind:'grenadeSupplyHit'}],100);renderer.update(state,100);
  expect(crate.material.emissiveIntensity).toBeGreaterThan(0);renderer.update(state,120);expect(supply.rotation.z).not.toBe(0);
  const tilt=supply.rotation.z;renderer.update(state,120);expect(supply.rotation.z).toBe(tilt);
  renderer.update(state,270);expect(crate.material.emissiveIntensity).toBeLessThan(.1);expect(supply.rotation.z).toBe(0);
  const idleScene=new THREE.Scene(),idle=new GrenadeRenderer(idleScene);idle.update(state,300);
  const idleMaterial=(idleScene.getObjectByName('grenade-supply')!.children[0] as THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>).material;
  renderer.present([{kind:'grenadeSupplyHit'}],300);renderer.update(state,300);renderer.reset();renderer.update(state,300);
  expect(crate.material.emissiveIntensity).toBe(idleMaterial.emissiveIntensity);expect(supply.scale.x).toBe(1);expect(scene.children).toEqual(children);idle.dispose();
  renderer.dispose();expect(scene.children).toHaveLength(0);
});

it.each([38,47])('stretches the existing analytic arc to shoreline depth %s without changing flight resources', depth => {
  const scene=new THREE.Scene(),renderer=new GrenadeRenderer(scene);
  const children=[...scene.children];
  for(const t of [0,.5,1]) {
    renderer.update({supply:null,originZ:5,elapsedSeconds:1+.65*t,
      flight:{startX:0,startZ:5,targetX:1.4,targetZ:5+depth,startedAtSeconds:1,
        flightSeconds:.65,damageEnemyHp:9,blastRadius:4}},0);
    const flight=scene.getObjectByName('grenade-flight')!;
    expect(flight.position.x).toBeCloseTo(-1.4*t);
    expect(flight.position.z).toBeCloseTo(depth*t);
    expect(Number.isFinite(flight.position.y)).toBe(true);
    if(t===.5)expect(flight.position.y).toBeGreaterThan(3);
    expect(scene.children).toEqual(children);
    expect(renderer.getDebugStats().dustCapacity).toBe(16);
  }
  renderer.dispose();
});

it('projects a deterministic arc and reuses bounded explosion resources across resets',()=>{
  const scene=new THREE.Scene(),renderer=new GrenadeRenderer(scene);
  const state:NonNullable<GameRenderState['grenade']>={supply:null,originZ:5,elapsedSeconds:1.325,
    flight:{startX:0,startZ:5,targetX:1.4,targetZ:15,startedAtSeconds:1,flightSeconds:.65,damageEnemyHp:9,blastRadius:2}};
  renderer.update(state,0);const flight=scene.getObjectByName('grenade-flight')!;
  expect(flight.position.x).toBeCloseTo(-.7);expect(flight.position.z).toBeCloseTo(5);expect(flight.position.y).toBeGreaterThan(3);
  const children=[...scene.children];
  for(let cycle=0;cycle<5;cycle++) {
    renderer.present([{kind:'grenadeDetonated',x:1.4,z:15,radius:2,victims:[]}],0);
    renderer.update({...state,flight:null},80);expect(renderer.getDebugStats().burst).toBe(true);
    expect(scene.getObjectByName('grenade-dust')!.position).toEqual(new THREE.Vector3());
    renderer.update({...state,flight:null},1200);expect(renderer.getDebugStats()).toMatchObject({supply:false,flight:false,burst:false,dustCapacity:16,activeExplosions:0});
    expect(scene.children).toEqual(children);renderer.reset();expect(scene.children.every(c=>!c.visible)).toBe(true);
  }
  renderer.dispose();expect(scene.children).toHaveLength(0);
});

it('doubles flash, ring and dust footprint for radius four without allocating more effects',()=>{
  const scene=new THREE.Scene(),renderer=new GrenadeRenderer(scene);
  const state={supply:null,flight:null,originZ:0,elapsedSeconds:1};
  const footprint=(radius:number)=>{
    renderer.reset();
    renderer.present([{kind:'grenadeDetonated',x:0,z:10,radius,victims:[]}],0);
    renderer.update(state,160);
    const dust=scene.getObjectByName('grenade-dust') as THREE.InstancedMesh,matrix=new THREE.Matrix4();
    dust.getMatrixAt(0,matrix);
    return {flash:scene.getObjectByName('grenade-flash')!.scale.x,
      ring:scene.getObjectByName('grenade-shock-ring')!.scale.x,dustX:new THREE.Vector3().setFromMatrixPosition(matrix).x};
  };
  const small=footprint(2),large=footprint(4);
  expect(large.flash).toBeCloseTo(small.flash*2);expect(large.ring).toBeCloseTo(small.ring*2);
  expect(large.dustX).toBeCloseTo(small.dustX*2);expect(renderer.getDebugStats().dustCapacity).toBe(16);
  renderer.dispose();
});

class ElementStub extends EventTarget {
  hidden=false; disabled=false; type='';className='';innerHTML='';textContent='';removed=false;
  children:ElementStub[]=[];attributes=new Map<string,string>();
  classList={add:vi.fn(),remove:vi.fn(),toggle:vi.fn()};
  private nodes=new Map<string,{textContent:string}>();
  append(e:ElementStub){this.children.push(e);}
  setAttribute(k:string,v:string){this.attributes.set(k,v);}
  querySelector(selector:string){if(!this.nodes.has(selector))this.nodes.set(selector,{textContent:''});return this.nodes.get(selector)!;}
  remove(){this.removed=true;}
}
afterEach(()=>vi.unstubAllGlobals());
it('does not rewrite inventory text, labels or classes on unchanged gameplay frames',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const viewport=new ElementStub(),hud=new GrenadeButton(viewport as unknown as HTMLElement,vi.fn()),button=viewport.children[0];
  hud.update(3,true,true);
  const label=vi.spyOn(button,'setAttribute'),write=vi.fn();
  Object.defineProperty(button.querySelector('strong'),'textContent',{set:write});
  button.classList.add.mockClear();button.classList.remove.mockClear();button.classList.toggle.mockClear();
  for(let i=0;i<120;i++)hud.update(3,true,true);
  expect(label).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();
  expect(button.classList.add).not.toHaveBeenCalled();expect(button.classList.remove).not.toHaveBeenCalled();
  expect(button.classList.toggle).not.toHaveBeenCalled();hud.dispose();
});
it('shows 3/2/1/0 with one acquisition accent, retaining reserves while unavailable',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const viewport=new ElementStub(),hud=new GrenadeButton(viewport as unknown as HTMLElement,vi.fn()),button=viewport.children[0];
  button.classList.add.mockClear();
  for(const count of [3,2,1,0]) {
    hud.update(count,true,count!==2);
    expect(button.querySelector('strong').textContent).toBe(String(count));
    expect(button.disabled).toBe(count===2||count===0);
  }
  expect(button.classList.add).toHaveBeenCalledExactlyOnceWith('grenade-acquired');
  expect(button.innerHTML).toContain('class="combat-keycue" aria-hidden="true">Q</span>');
  hud.dispose();
});
it('only enables a held valid active charge, isolates pointer input, and resets the acquisition pulse',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const viewport=new ElementStub(),activate=vi.fn(),hud=new GrenadeButton(viewport as unknown as HTMLElement,activate),button=viewport.children[0];
  expect(button.hidden).toBe(true);button.dispatchEvent(new Event('click'));expect(activate).not.toHaveBeenCalled();
  hud.update(1,true,false);expect(button.hidden).toBe(false);expect(button.disabled).toBe(true);
  expect(button.querySelector('strong').textContent).toBe('1');
  expect(button.innerHTML).not.toMatch(/GRENADE|READY|HELD|EMPTY|<small/);
  expect(button.attributes.get('aria-label')).toContain('temporarily unavailable');
  hud.update(1,true,true);button.dispatchEvent(new Event('click'));expect(activate).toHaveBeenCalledOnce();
  expect(button.attributes.get('aria-label')).toBe('Throw Grenade (1 available, Q)');
  const pointer=new Event('pointerdown'),stop=vi.spyOn(pointer,'stopPropagation');button.dispatchEvent(pointer);expect(stop).toHaveBeenCalledOnce();
  hud.update(0,true,true);button.dispatchEvent(new Event('click'));expect(activate).toHaveBeenCalledOnce();
  expect(button.querySelector('strong').textContent).toBe('0');expect(button.classList.toggle).toHaveBeenLastCalledWith('grenade-empty',true);
  hud.reset();expect(button.hidden).toBe(true);expect(button.disabled).toBe(true);hud.dispose();expect(button.removed).toBe(true);
});
