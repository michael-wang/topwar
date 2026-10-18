import data from '../public/game-data/game.json';
import { GameConfigSchema } from '../src/config/configSchema';
import { afterEach, expect, it, vi } from 'vitest';
import { BattleInfoHud } from '../src/ui/BattleInfoHud';
class Element {
  dataset: Record<string,string>={}; children: Element[]=[]; className=''; textContent='';
  style: Record<string,string>={}; hidden=false; innerHTML=''; removed=false; ariaLabel='';
  attributes: Record<string,string>={};
  classList={
    toggle:(name:string,on:boolean)=>{const names=this.className.split(' ').filter(n=>n&&n!==name);if(on)names.push(name);this.className=names.join(' ');},
    remove:(name:string)=>this.classList.toggle(name,false),
  };
  append(...children:Element[]){this.children.push(...children);}
  setAttribute(key:string,value:string){this.attributes[key]=value;}
  remove(){this.removed=true;}
}
const balance=GameConfigSchema.parse(data).catharsis!.progression;
function make(){
  vi.stubGlobal('document',{createElement:()=>new Element()});const viewport=new Element(),hud=new BattleInfoHud(viewport as unknown as HTMLElement);
  const root=viewport.children[0], main=root.children[0], weapon=main.children[0], bullets=main.children[1], squad=root.children[1];
  return {hud,root,weapon,bullets,squad,update:(level:number,now=0)=>hud.update({level,xp:0},balance,now)};
}
const filled=(row:Element)=>row.children.filter(p=>p.className.includes('is-filled'));
const animated=(row:Element)=>row.children.map((p,i)=>p.className.includes('is-upgraded')?i:-1).filter(i=>i>=0);
afterEach(()=>vi.unstubAllGlobals());
it.each([[1,1,null],[2,2,null],[3,3,null],[4,3,2],[5,3,3],[6,1,null],[7,2,null],[8,3,null],[9,3,2],[10,3,3],[11,3,4],[12,3,5]] as const)(
  'shows Lv%i as %i cartridge pips and optional squad stage %s without visible text', (level,count,squadStage)=>{
    const f=make();f.update(level);
    expect(f.root.style.pointerEvents).toBe('none');expect(f.root.attributes.role).toBe('group');
    expect(f.weapon.innerHTML).toContain('viewBox="0 0 44 20"');
    expect(f.bullets.children).toHaveLength(3);expect(filled(f.bullets)).toHaveLength(count);
    expect(f.bullets.children.every(p=>p.className.includes('xp-pip-cartridge'))).toBe(true);
    for(const pip of f.bullets.children.filter(p=>p.className.includes('is-empty')))expect(pip.innerHTML).toContain('fill="none"');
    expect(f.squad.hidden).toBe(squadStage===null);
    if(squadStage)expect(filled(f.squad)).toHaveLength(squadStage);
    expect(f.root.children.flatMap(r=>[r,...r.children]).every(e=>e.textContent==='')).toBe(true);
    expect(animated(f.bullets)).toEqual([]);expect(animated(f.squad)).toEqual([]);
    f.hud.dispose();expect(f.root.removed).toBe(true);
  });
it('pulses only newly filled cartridges on fire-rate upgrades, without replay on XP updates',()=>{
  const f=make();f.update(1);f.update(2,100);
  expect(animated(f.bullets)).toEqual([1]);expect(animated(f.squad)).toEqual([]);
  expect(f.weapon.className).not.toContain('weapon-evolution');
  f.hud.update({level:2,xp:10},balance,400);expect(animated(f.bullets)).toEqual([1]);
  f.update(2,580);expect(animated(f.bullets)).toEqual([]);
  f.update(3,600);expect(animated(f.bullets)).toEqual([2]);
});
it('reveals a separate squad row and pulses only the newly unlocked soldier',()=>{
  const f=make();f.update(3);f.update(4,100);
  expect(f.squad.hidden).toBe(false);expect(animated(f.squad)).toEqual([1]);expect(animated(f.bullets)).toEqual([]);
  f.update(5,600);expect(animated(f.squad)).toEqual([2]);expect(filled(f.bullets)).toHaveLength(3);
});
it('swaps and pulses the MG silhouette, resets cartridge pips and omits the squad row',()=>{
  const f=make();f.update(5);const rifle=f.weapon.innerHTML;f.update(6,100);
  expect(f.root.dataset.weaponFamily).toBe('machineGun');expect(f.weapon.innerHTML).not.toBe(rifle);
  expect(f.weapon.className).toContain('weapon-evolution');expect(filled(f.bullets)).toHaveLength(1);expect(f.squad.hidden).toBe(true);
  expect(animated(f.bullets)).toEqual([]);expect(animated(f.squad)).toEqual([]);
  f.update(6,100);expect(f.weapon.className).toContain('weapon-evolution'); // Frozen presentation clock on Pause.
  f.update(6,580);expect(f.weapon.className).not.toContain('weapon-evolution');
  f.hud.reset();f.update(6,0);expect(f.weapon.className).not.toContain('weapon-evolution');
});
it('handles multi-level grants and regressed/restored presentation without stale upgrade flashes',()=>{
  const f=make();f.update(1);f.update(5,100);
  expect(animated(f.bullets)).toEqual([1,2]);expect(animated(f.squad)).toEqual([1,2]);
  f.update(2,120);expect(animated(f.bullets)).toEqual([]);expect(f.squad.hidden).toBe(true);
  f.hud.reset();expect(f.root.hidden).toBe(true);f.update(1,0);expect(f.root.hidden).toBe(false);
  expect(animated(f.bullets)).toEqual([]);
});

it('reveals MG squad pips at Lv9/10 without another weapon evolution',()=>{
  const f=make();f.update(6);const model=f.weapon.innerHTML;
  f.update(9,100);expect(f.squad.hidden).toBe(false);expect(animated(f.squad)).toEqual([1]);
  expect(filled(f.squad)).toHaveLength(2);expect(filled(f.bullets)).toHaveLength(3);
  f.update(10,600);expect(animated(f.squad)).toEqual([2]);expect(filled(f.squad)).toHaveLength(3);
  expect(f.weapon.innerHTML).toBe(model);expect(f.weapon.className).not.toContain('weapon-evolution');
});

it('fills MG cartridges through Lv7/8 without recruiting or replaying the silhouette evolution',()=>{
  const f=make();f.update(6);const model=f.weapon.innerHTML;
  f.update(7,100);expect(animated(f.bullets)).toEqual([1]);expect(filled(f.bullets)).toHaveLength(2);
  expect(f.squad.hidden).toBe(true);expect(animated(f.squad)).toEqual([]);
  f.update(8,600);expect(animated(f.bullets)).toEqual([2]);expect(filled(f.bullets)).toHaveLength(3);
  expect(f.squad.hidden).toBe(true);expect(f.weapon.innerHTML).toBe(model);
  expect(f.weapon.className).not.toContain('weapon-evolution');
});

it('shows only the saved family capacity and pulses the new fourth/fifth MG slot',()=>{
  const f=make();f.update(5);expect(f.squad.children.filter(p=>!p.hidden)).toHaveLength(3);
  f.update(10);expect(f.squad.children.filter(p=>!p.hidden)).toHaveLength(5);
  f.update(11,100);expect(animated(f.squad)).toEqual([3]);expect(f.squad.ariaLabel).toContain('已解鎖小隊階段 4／5');
  f.update(12,600);expect(animated(f.squad)).toEqual([4]);expect(filled(f.squad)).toHaveLength(5);
  const old={...balance,levelPlan:balance.levelPlan.slice(0,10),xpRequirements:balance.xpRequirements.slice(0,9)};
  f.hud.reset();f.hud.update({level:10,xp:0},old,0);expect(f.squad.children.filter(p=>!p.hidden)).toHaveLength(3);
});
