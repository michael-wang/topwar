import * as THREE from 'three';
import { expect, it } from 'vitest';
import bloodSource from '../src/rendering/enemies/IntegratedDeathBlood.ts?raw';
import { BLOOD_PIECE_COUNTS, bloodPieceVelocity, integratedBloodGeometry, IntegratedDeathBlood, writeBloodFlight } from '../src/rendering/enemies/IntegratedDeathBlood';
import { fluidRibbonGeometry, RIBBON_COUNTS, RIBBON_LIFETIME_MS, splashShapes, SPLASH_COMPOSITIONS, activeRibbonCount } from '../src/rendering/enemies/FluidBloodSplash';

it('uses irregular extruded tongues, embedded roots, short lifetimes and rounded droplets without cones',()=>{
 expect(bloodSource).not.toContain('ConeGeometry');
 for(const role of ['grunt','heavy','giant'] as const){
  const ribbon=fluidRibbonGeometry(role),drops=integratedBloodGeometry(role);
  expect(ribbon.getAttribute('position').count/3).toBe(92*RIBBON_COUNTS[role]);
  expect(RIBBON_LIFETIME_MS[role]).toBeLessThanOrEqual(360);
  const p=ribbon.getAttribute('position');expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
  expect(Array.from(p.array).filter((_,i)=>i%3===2).some(v=>v!==0)).toBe(true);
  for(const shapes of splashShapes[role]){expect(shapes.some(r=>r.direction.z<0)).toBe(true);expect(shapes.some(r=>r.direction.z>0)).toBe(true);}
  for(const shapes of splashShapes[role])for(const r of shapes){expect(Math.abs(r.origin.x)).toBeLessThan(.3);expect(r.origin.y).toBeGreaterThan(.15);expect(r.origin.y).toBeLessThan(role==='giant'?1:.6);}
  // Smooth normals and rounded ellipsoidal caps, not a pointed apex mesh.
  const n=drops.getAttribute('normal');expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
  expect(drops.getAttribute('position').count).toBeLessThan(2000);
  ribbon.dispose();drops.dispose();
 }
});
it('detached droplets inherit their parent splash direction and land analytically',()=>{
 for(const role of ['grunt','heavy','giant'] as const){
  const blood=new IntegratedDeathBlood(new THREE.Scene()),matrix=new THREE.Matrix4().makeScale(1.4,1.12,1.4);blood.spawn(3,role,0,matrix);
  const slot=(blood as unknown as {slots:{gravity:number;expansion:number}[]}).slots[0],flight=new Float64Array(11);
  for(let variant=0;variant<SPLASH_COMPOSITIONS;variant++)for(let piece=0;piece<BLOOD_PIECE_COUNTS[role];piece++){
   const v=bloodPieceVelocity(role,variant,piece),direction=splashShapes[role][variant][piece%activeRibbonCount(role,variant)].direction;
   expect(new THREE.Vector3(...v).normalize().dot(direction)).toBeGreaterThan(.7);expect(v[1]).toBeGreaterThan(0);
   writeBloodFlight(role,variant,piece,matrix,slot.gravity,flight);
   expect(flight[4]/slot.gravity).toBeGreaterThan(0);expect(flight[4]/slot.gravity).toBeLessThan(flight[5]);
   expect(flight[1]+flight[4]*flight[5]-.5*slot.gravity*flight[5]**2).toBeCloseTo(flight[3]);
  }blood.dispose();
 }
});
