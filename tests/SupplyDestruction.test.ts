import {expect,it,vi} from 'vitest';
import {Simulation} from '../src/simulation/Simulation';
import {emptyGrenade,placeGrenadeSupply} from '../src/simulation/grenade';
import {carnivalOptions} from '../scripts/qa/carnivalPilot';
import {pilotTuning} from '../scripts/qa/p15Pilot';
import {GameAudio} from '../src/audio/GameAudio';
const make=(level=3,members=1,inventory=0,recurring=false)=>{
  const sim=new Simulation({...carnivalOptions,startSquad:members,level:{id:'supply',length:100,enemyGroups:[],upgradeGates:[]}});
  const s=sim.getState();s.progression={level,xp:0};
  s.grenade={...emptyGrenade(),lv3EnteredAtSeconds:0,supplySpawnedAtSeconds:0,acquiredAtSeconds:recurring?0:null,inventory,
    supply:{...placeGrenadeSupply(s,s.catharsis!.balance.grenade),...(recurring?{rewardAmount:1 as const}:{})}};
  s.weapons.rifleCooldownRemainingSeconds=1000;s.weapons.rifleMemberCooldowns=Array(members).fill(1000);
  sim.restoreState(s);return sim;
};
const step=(s:Simulation,n=1)=>{for(let i=0;i<n;i++)s.step(1/60,{targetX:0},pilotTuning);};
const hit=(sim:Simulation,count=1)=>{
  const s=sim.getState();s.projectiles=Array.from({length:count},()=>({id:s.weapons.nextProjectileId++,kind:'machineGun' as const,tier:1,
    memberIndex:0,lane:2,x:0,z:13.5,slopeX:0,speed:60,damage:999,remainingRange:20,blastRadius:0,hitRadiusBonus:0,penetrationRemaining:0}));
  sim.restoreState(s);step(sim);
};
it('requires three stages, consumes recovery hits without banking damage, and opens on the third event',()=>{
  const sim=make(6);expect(sim.getState().grenade!.supply!.destruction!.stage).toBe(0);
  hit(sim,12);const first=sim.getState();expect(first.grenade!.supply!.destruction).toMatchObject({stage:1,recoverySeconds:.7});
  expect(first.projectiles).toEqual([]);expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeSupplyDamaged',stage:1}]);
  for(let tick=0;tick<41;tick++)hit(sim,3);
  expect(sim.getState().grenade!.supply!.destruction!.stage).toBe(1);expect(sim.consumeGrenadeEvents()).toEqual([]);
  step(sim,60);expect(sim.getState().grenade!.supply!.destruction!.stage).toBe(1);
  hit(sim,3);expect(sim.getState().grenade!.supply!.destruction!.stage).toBe(2);
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeSupplyDamaged',stage:2}]);
  step(sim,40);hit(sim,3);expect(sim.getState().grenade!.inventory).toBe(0);
  hit(sim,3);expect(sim.getState().grenade!.supply).toBeNull();expect(sim.getState().grenade!.inventory).toBe(3);
  expect(sim.consumeGrenadeEvents()).toEqual([{kind:'grenadeSupplyOpened',x:0,z:14,amount:3}]);
  expect(sim.getState().projectiles).toHaveLength(2);expect(sim.getState().progression!.xp).toBe(0);
  step(sim,120);expect(sim.consumeGrenadeEvents()).toEqual([]);expect(sim.getState().grenade!.inventory).toBe(3);
});
it.each([0,1,2,3])('recurring supply grants +1 immediately and clamps inventory %i',inventory=>{
  const sim=make(6,1,inventory,true);hit(sim);step(sim,41);hit(sim);step(sim,41);hit(sim);
  expect(sim.getState().grenade!.inventory).toBe(Math.min(3,inventory+1));
  expect(sim.consumeGrenadeEvents().at(-1)).toEqual({kind:'grenadeSupplyOpened',x:0,z:14,amount:1});
});
it.each([0,1,2])('restores exact stage %i and recovery through deterministic continuation without reward replay',stage=>{
  const sim=make(6);for(let i=0;i<stage;i++){hit(sim);if(i<stage-1)step(sim,41);}
  const saved=sim.getState(),clone=make(6);clone.restoreState(JSON.parse(JSON.stringify(saved)));
  expect(clone.getState()).toEqual(saved);expect(clone.consumeGrenadeEvents()).toEqual([]);
  for(let t=0;t<100;t++){hit(sim,3);hit(clone,3);expect(sim.getState()).toEqual(clone.getState());}
  clone.restoreState(clone.getState());expect(clone.consumeGrenadeEvents()).toEqual([]);
  expect(make(6).getState().grenade!.supply!.destruction).toMatchObject({stage:0,recoverAtSeconds:0});
});
it.each([[3,1],[6,1],[8,3]])('opens within 1.4–2 seconds of first impact for Lv%i / %i members', (level,members)=>{
  const sim=make(level,members),s=sim.getState(),rate=level===3?4.5:18;
  s.weapons.rifleCooldownRemainingSeconds=0;s.weapons.rifleMemberCooldowns=Array.from({length:members},(_,i)=>i/rate/members);sim.restoreState(s);
  const times:number[]=[];let consumed=0;
  for(let t=0;t<240&&sim.getState().grenade!.supply;t++){
    const before=sim.getState();step(sim);const after=sim.getState();
    consumed+=before.projectiles.length+(after.weapons.nextProjectileId-before.weapons.nextProjectileId)-after.projectiles.length;
    for(const e of sim.consumeGrenadeEvents())if(e.kind==='grenadeSupplyDamaged'||e.kind==='grenadeSupplyOpened')times.push(after.elapsedSeconds);
  }
  expect(times).toHaveLength(3);expect(times[2]-times[0]).toBeGreaterThanOrEqual(1.4-1e-8);expect(times[2]-times[0]).toBeLessThanOrEqual(2);
  expect(consumed).toBeGreaterThan(3);expect(sim.getState().grenade!.inventory).toBe(3);
});
it('rejects ambiguous modes, stages and invalid/future recovery clocks atomically',()=>{
  const sim=make(),original=sim.getState();
  for(const patch of [{stage:3},{stage:1.5},{stage:1,recoverAtSeconds:20},{stage:0,recoverAtSeconds:.7},{recoverySeconds:0},{mode:'hits'}]) {
    const bad=sim.getState();Object.assign(bad.grenade!.supply!.destruction!,patch);
    expect(()=>sim.restoreState(bad)).toThrow();expect(sim.getState()).toEqual(original);
  }
  const bad=sim.getState();bad.grenade!.supply!.hitsRequired=10;bad.grenade!.supply!.hitProgress=2;
  expect(()=>sim.restoreState(bad)).toThrow();expect(sim.getState()).toEqual(original);
});
it('emits only the three successful sounds, then the reward chime on presentation time, and cancels on Retry',()=>{
  const audio=new GameAudio(),play=vi.spyOn(audio,'play').mockImplementation(()=>{});
  audio.presentSupply([{kind:'grenadeSupplyDamaged',stage:1}],0);audio.presentSupply([],500);
  audio.presentSupply([{kind:'grenadeSupplyDamaged',stage:2}],700);
  audio.presentSupply([{kind:'grenadeSupplyOpened',x:0,z:14,amount:3}],1400);
  for(let i=0;i<5;i++)audio.presentSupply([],1400);
  expect(play.mock.calls.map(c=>c[0])).toEqual(['supplyImpact','supplyCrack','supplyOpen']);
  audio.presentSupply([],1610);audio.presentSupply([],2000);
  expect(play.mock.calls.map(c=>c[0])).toEqual(['supplyImpact','supplyCrack','supplyOpen','reward']);
  audio.presentSupply([{kind:'grenadeSupplyOpened',x:0,z:14,amount:1}],2100);audio.resetObservation();audio.presentSupply([],2500);
  expect(play.mock.calls.filter(c=>c[0]==='reward')).toHaveLength(1);audio.dispose();
});

it('synthesizes distinct impact/crack/open tones and ducks existing MG voices for opening',async()=>{
  const parameter=()=>({value:1,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const gains:ReturnType<typeof gain>[]=[];
  function gain(){return{gain:parameter(),connect:vi.fn(),disconnect:vi.fn()};}
  const voices:{frequency:ReturnType<typeof parameter>;type:string;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}[]=[];
  const context={state:'running',currentTime:0,destination:{},resume:async()=>{},close:async()=>{},
    createGain:()=>{const node=gain();gains.push(node);return node;},
    createOscillator:()=>{const voice={frequency:parameter(),type:'',connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};voices.push(voice);return voice;}};
  vi.stubGlobal('AudioContext',function(){return context;});
  const audio=new GameAudio();
  try {
    await audio.activate();audio.play('machineGun');const bus=gains[1];
    audio.play('supplyImpact');audio.play('supplyCrack');audio.play('supplyOpen');
    expect(voices).toHaveLength(7);
    expect([voices[1],voices[3],voices[5]].map(v=>v.frequency.setValueAtTime.mock.calls[0][0])).toEqual([1900,240,160]);
    expect(voices.every(v=>v.start.mock.calls.length===1)).toBe(true);
    expect(gains[3].connect).toHaveBeenCalledWith(bus);
    expect(bus.connect).toHaveBeenCalledWith(gains[2]);
    expect(gains[2].connect).toHaveBeenCalledWith(gains[0]);
    audio.syncRadio('en', 0, false);
    expect(gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(.6,.15);
    expect(bus.gain.setValueAtTime).toHaveBeenCalledWith(.3,0);
    expect(bus.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(1,.45);
    audio.resetObservation();expect(bus.gain.cancelScheduledValues).toHaveBeenCalled();expect(bus.gain.value).toBe(1);
    expect(gains[2].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(1,.15);
  }finally{audio.dispose();vi.unstubAllGlobals();}
});
