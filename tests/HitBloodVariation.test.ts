import { expect, it } from 'vitest';
import { hitBloodVariation, HIT_BLOOD_ANCHORS } from '../src/rendering/enemies/HitBloodVariation';
import { hitBloodAtlas } from '../src/rendering/enemies/BloodSplat';
import { HIT_BLOOD_TIMING } from '../src/rendering/enemies/EnemyHitImpulse';
it('uses four distinct deterministic masks in one atlas',()=>{
 const atlas=hitBloodAtlas(),again=hitBloodAtlas();expect(atlas.image.width).toBe(192);expect(atlas.image.data).toEqual(again.image.data);
 const cells=Array.from({length:4},(_,v)=>Array.from({length:96*96},(_,i)=>atlas.image.data[((Math.floor(v/2)*96+Math.floor(i/96))*192+v%2*96+i%96)*4+3]).join(','));
 expect(new Set(cells).size).toBe(4);atlas.dispose();again.dispose();
});
it('breaks adjacent anchor and variant repetition for six Giant impacts, with bounded variation',()=>{
 expect(HIT_BLOOD_ANCHORS.giant).toHaveLength(6);expect(HIT_BLOOD_ANCHORS.heavy).toHaveLength(4);
 for(const role of ['grunt','heavy','giant'] as const)for(let id=0;id<30;id++){
  let previous=hitBloodVariation(id,0,role);
  for(let sequence=1;sequence<=12;sequence++){
   const next=hitBloodVariation(id,sequence,role);expect(next).toEqual(hitBloodVariation(id,sequence,role));
   expect(next.anchor).not.toBe(previous.anchor);expect(next.variant).not.toBe(previous.variant);
   expect(next.size).toBeGreaterThanOrEqual(.85);expect(next.size).toBeLessThanOrEqual(1.15);
   expect(next.aspect).toBeGreaterThanOrEqual(.82);expect(next.aspect).toBeLessThanOrEqual(1.2);
   expect(Math.abs(next.x)).toBeLessThanOrEqual(.20);expect(next.y).toBeGreaterThan(.3);expect(next.y).toBeLessThan(.7);
   previous=next;
  }
  expect(HIT_BLOOD_TIMING[role].bloodEndMs).toBe(170);expect(HIT_BLOOD_TIMING[role].bloodPulseCount).toBe(1);
 }
});
