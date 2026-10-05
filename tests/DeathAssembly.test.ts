import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGiantFamily, createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { DEATH_PIECE_COUNTS, deathVariant, assemblyBatchGeometry } from '../src/rendering/enemies/DeathAssembly';
import { integratedBloodGeometry, BLOOD_PIECE_COUNTS, bloodPieceOrigin, IntegratedDeathBlood } from '../src/rendering/enemies/IntegratedDeathBlood';
import { CrowdDeathBatches } from '../src/rendering/enemies/CrowdDeathBatches';
import { prepareEnemyDeathMaterial } from '../src/rendering/enemies/EnemyDeathMaterial';

it('bakes semantic pieces into the exact accepted pose with three deterministic rigid patterns', () => {
  const variants=new Set<number>();
  for(let id=0;id<100;id++){expect(deathVariant(id)).toBe(deathVariant(id));variants.add(deathVariant(id));}expect(variants.size).toBe(3);
  const families=[createChibiHeavyFamily(),createChibiGiantFamily()];
  for(const f of families){
    const a=f.deathAssembly!,pieces=new Set<number>();
    expect(a.body.getAttribute('position').array).toEqual(f.lethalReaction!.final.geometry.getAttribute('position').array);
    expect(a.helmet.getAttribute('position').array).toEqual(f.helmet.geometry.getAttribute('position').array);
    const geometries=[a.body,a.helmet];if('weapon' in a)geometries.push(a.weapon);
    for(const geometry of geometries){
      const ids=geometry.getAttribute('deathPieceId'),dirs=geometry.getAttribute('deathPieceDirection'),directions=new Map<number,string>();
      for(let i=0;i<ids.count;i++){const id=ids.getX(i),d=[dirs.getX(i),dirs.getY(i),dirs.getZ(i)];pieces.add(id);expect(Math.hypot(...d)).toBeCloseTo(1);const key=d.join(',');if(directions.has(id))expect(key).toBe(directions.get(id));else directions.set(id,key);}
    }
    expect(pieces.size).toBe(DEATH_PIECE_COUNTS[f.role]);expect(a.pieceCount).toBe(pieces.size);
    if('weapon' in a)expect(new Set(Array.from(a.weapon.getAttribute('deathPieceId').array))).toEqual(new Set([7]));
    expect(f.body.geometry.getAttribute('deathPieceId')).toBeUndefined();f.dispose();
  }
});
it('keeps separation in world units and preserves instanced authored color/fade/variant without extra piece draws', () => {
  const scene=new THREE.Scene(),family=createChibiHeavyFamily(),group=new THREE.Group(),mat=new THREE.MeshStandardMaterial();prepareEnemyDeathMaterial(mat);
  group.add(new THREE.Mesh(family.deathAssembly!.body,mat));group.scale.set(2,3,4);
  const batches=new CrowdDeathBatches(scene,48);batches.begin();for(let i=0;i<48;i++)batches.submit(group,.14,.5,i%3);batches.finish();
  const mesh=scene.children[0]as THREE.InstancedMesh;expect(mesh.count).toBe(48);expect(scene.children).toHaveLength(1);
  expect(mesh.geometry.getAttribute('deathBreakup').getX(0)).toBeCloseTo(.035);expect(mesh.geometry.getAttribute('deathVariant').getX(2)).toBe(2);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'}as Parameters<THREE.Material['onBeforeCompile']>[0];(mesh.material as THREE.Material).onBeforeCompile(shader,{}as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain('openedPieceDirection(deathPieceDirection, deathPieceId, deathShellRole, deathVariant)');expect(shader.fragmentShader).not.toContain('deathRed');
  batches.dispose();mat.dispose();family.dispose();
  const sphere=new THREE.SphereGeometry(1,8,6),clone=assemblyBatchGeometry(sphere);expect(Array.from(clone.getAttribute('deathPieceDirection').array).every(v=>v===0)).toBe(true);clone.dispose();sphere.dispose();
});
it('uses volumetric blood within role bounds, bounded role draws, and independent blood color',()=>{
  for(const role of ['grunt','heavy','giant']as const){const geometry=integratedBloodGeometry(role);geometry.computeBoundingBox();expect(geometry.boundingBox!.max.z-geometry.boundingBox!.min.z).toBeGreaterThan(.08);
    expect(new Set(Array.from(geometry.getAttribute('bloodPieceId').array)).size).toBe(BLOOD_PIECE_COUNTS[role]);
    for(let variant=0;variant<3;variant++)for(let i=0;i<BLOOD_PIECE_COUNTS[role];i++){const o=bloodPieceOrigin(role,variant,i);expect(Math.abs(o[0])).toBeLessThan(.35);expect(o[1]).toBeGreaterThan(.15);expect(o[1]).toBeLessThan(role==='giant'?1.1:.7);}
    expect(geometry.getAttribute('position').count).toBeLessThan(2000);geometry.dispose();}
  const scene=new THREE.Scene(),blood=new IntegratedDeathBlood(scene);for(let i=0;i<100;i++)blood.spawn(i,'grunt',0,new THREE.Matrix4());blood.update(200);
  const mesh=scene.getObjectByName('enemy-3d-blood-grunt')as THREE.InstancedMesh;expect(mesh.count).toBe(64);expect(scene.children).toHaveLength(6);expect(scene.getObjectByName('enemy-blood-splats')).toBeUndefined();
  const material=mesh.material as THREE.MeshStandardMaterial;expect(material.emissive.getHex()).toBe(0);expect(material.depthTest).toBe(true);expect(material.blending).toBe(THREE.NormalBlending);
  const colors=Array.from(mesh.geometry.getAttribute('color').array);blood.update(400);expect(Array.from(mesh.geometry.getAttribute('color').array)).toEqual(colors);
  blood.update(520);expect(mesh.count).toBe(0);blood.reset();blood.dispose();expect(scene.children).toHaveLength(0);
});
