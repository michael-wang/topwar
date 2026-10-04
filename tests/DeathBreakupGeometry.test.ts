import * as THREE from 'three';
import { expect, it } from 'vitest';
import { deathBreakupGeometry } from '../src/rendering/enemies/DeathBreakupGeometry';
import { CrowdDeathBatches } from '../src/rendering/enemies/CrowdDeathBatches';
import { prepareEnemyDeathMaterial } from '../src/rendering/enemies/EnemyDeathMaterial';
it('clones triangles with identical rigid per-triangle vectors, deterministic and unit bounded',()=>{
 const source=new THREE.SphereGeometry(.5,8,6),g=deathBreakupGeometry(source),again=deathBreakupGeometry(source),d=g.getAttribute('deathBreakupDirection');
 expect(source.getAttribute('deathBreakupDirection')).toBeUndefined();expect(source.index).not.toBeNull();expect(g.index).toBeNull();expect(d.array).toEqual(again.getAttribute('deathBreakupDirection').array);
 for(let i=0;i<d.count;i+=3){const vector=new THREE.Vector3().fromBufferAttribute(d,i);expect(vector.length()).toBeCloseTo(1);for(let j=1;j<3;j++)expect(new THREE.Vector3().fromBufferAttribute(d,i+j)).toEqual(vector);}
 g.dispose();again.dispose();source.dispose();
});
it('converts separation to world-unit cap under nonuniform scale, uses shader instancing without extra pieces',()=>{
 const scene=new THREE.Scene(),source=new THREE.SphereGeometry(.5,8,6),mat=new THREE.MeshStandardMaterial(),group=new THREE.Group();prepareEnemyDeathMaterial(mat);
 group.add(new THREE.Mesh(source,mat));group.scale.set(2,3,4);const batches=new CrowdDeathBatches(scene,48);batches.begin();batches.submit(group,1,.1,.5);batches.finish();
 const mesh=scene.children[0] as THREE.InstancedMesh;expect(mesh.count).toBe(1);expect(mesh.geometry.getAttribute('deathBreakup').getX(0)).toBeCloseTo(.025);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'} as Parameters<THREE.Material['onBeforeCompile']>[0];(mesh.material as THREE.Material).onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 expect(shader.vertexShader).toContain('transformed += deathBreakupDirection * deathBreakup');expect(shader.fragmentShader).not.toContain('deathRed');
 batches.dispose();source.dispose();mat.dispose();expect(scene.children).toHaveLength(0);
});
