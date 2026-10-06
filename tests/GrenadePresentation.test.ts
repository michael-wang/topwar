import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { GrenadeRenderer } from '../src/rendering/GrenadeRenderer';
import { GrenadeButton } from '../src/ui/GrenadeButton';
import type { GameRenderState } from '../src/rendering/RenderState';

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
    renderer.update({...state,flight:null},900);expect(renderer.getDebugStats()).toEqual({supply:false,flight:false,burst:false,dustCapacity:16});
    expect(scene.children).toEqual(children);renderer.reset();expect(scene.children.every(c=>!c.visible)).toBe(true);
  }
  renderer.dispose();expect(scene.children).toHaveLength(0);
});

class ElementStub extends EventTarget {
  hidden=false; disabled=false; type='';className='';innerHTML='';textContent='';removed=false;
  children:ElementStub[]=[];attributes=new Map<string,string>();
  classList={add:vi.fn(),remove:vi.fn()};
  append(e:ElementStub){this.children.push(e);}
  setAttribute(k:string,v:string){this.attributes.set(k,v);}
  querySelector(){return this;}
  remove(){this.removed=true;}
}
afterEach(()=>vi.unstubAllGlobals());
it('only enables a held valid active charge, isolates pointer input, and resets the acquisition pulse',()=>{
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const viewport=new ElementStub(),activate=vi.fn(),hud=new GrenadeButton(viewport as unknown as HTMLElement,activate),button=viewport.children[0];
  expect(button.hidden).toBe(true);button.dispatchEvent(new Event('click'));expect(activate).not.toHaveBeenCalled();
  hud.update(1,true,false);expect(button.hidden).toBe(false);expect(button.disabled).toBe(true);
  hud.update(1,true,true);button.dispatchEvent(new Event('click'));expect(activate).toHaveBeenCalledOnce();
  const pointer=new Event('pointerdown'),stop=vi.spyOn(pointer,'stopPropagation');button.dispatchEvent(pointer);expect(stop).toHaveBeenCalledOnce();
  hud.update(0,true,true);button.dispatchEvent(new Event('click'));expect(activate).toHaveBeenCalledOnce();
  hud.reset();expect(button.hidden).toBe(true);expect(button.disabled).toBe(true);hud.dispose();expect(button.removed).toBe(true);
});
