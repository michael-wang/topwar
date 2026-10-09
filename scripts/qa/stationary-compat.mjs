// Pass snapshots captured by stationary-metrics on the accepted baseline.
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=process.argv[2]??'artifacts/stage1-p25/before';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {Simulation}=await server.ssrLoadModule('/src/simulation/Simulation.ts');
  const {carnivalOptions}=await server.ssrLoadModule('/scripts/qa/carnivalPilot.ts');
  const {pilotTuning}=await server.ssrLoadModule('/scripts/qa/p15Pilot.ts');
  const results=[];
  for(const seed of [1,17,42,99,2026])for(const [stage,old]of Object.entries(JSON.parse(readFileSync(`${source}/snapshots-${seed}.json`)))) {
    const sim=new Simulation(carnivalOptions);sim.restoreState(old);const migrated=sim.getState();
    assert.equal(migrated.player.z,0);
    for(const [i,e]of migrated.enemies.entries())assert.equal(e.z,old.enemies[i].z-old.player.z);
    for(const [i,p]of migrated.projectiles.entries())assert.equal(p.z,old.projectiles[i].z-old.player.z);
    if(old.grenade.flight)assert.equal(migrated.grenade.flight.targetZ,old.grenade.flight.targetZ-old.player.z);
    for(const k of ['progression','weapons','giantEncounter','carnival','postCapSurvival'])assert.deepEqual(migrated[k],old[k]);
    const clone=new Simulation(carnivalOptions);clone.restoreState(JSON.parse(JSON.stringify(migrated)));
    assert.deepEqual(clone.getState(),migrated);
    for(let tick=0;tick<600;tick++)for(const s of [sim,clone])s.step(1/60,{targetX:0},pilotTuning);
    assert.deepEqual(clone.getState(),sim.getState());
    results.push({seed,stage,oldZ:old.player.z,newZ:migrated.player.z,nextAtSeconds:migrated.defenseWaves.nextAtSeconds,replay:true});
  }
  writeFileSync(`${source}/compatibility.json`,JSON.stringify(results,null,2));
  console.log(`Passed ${results.length} baseline snapshots: rebasing, preserved lifecycle/cooldowns, deterministic continuation`);
} finally {await server.close();}
