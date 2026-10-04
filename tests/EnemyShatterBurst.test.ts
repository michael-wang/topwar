import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { EnemyShatterBurst, SHATTER_CAPACITY, SHATTER_COLORS, shatterDirection } from '../src/rendering/enemies/EnemyShatterBurst';
import { ENEMY_DEATH_TIMING } from '../src/presentation/EnemyDeathTiming';

it('captures semantic role pieces, expands briefly without gravity/ground state or shrinking, then fades', () => {
  for(const role of ['grunt','heavy','giant'] as const){
    const scene=new THREE.Scene(),burst=new EnemyShatterBurst(scene),frozen=new THREE.Group();
    // Low root demonstrates that no ground clamp/resting policy is hidden in the effect.
    frozen.position.set(1,-2,8); frozen.rotation.y=Math.PI; frozen.add(new THREE.Group(),new THREE.Group());
    const timing=ENEMY_DEATH_TIMING[role];burst.spawn(42,role,frozen,100);
    burst.update(100+timing.shatterMs-1);expect(burst.meshes.every(mesh=>mesh.count===0)).toBe(true);
    burst.update(100+timing.shatterMs);expect(burst.meshes.map(mesh=>mesh.count)).toEqual([5,3]);
    const starts=burst.meshes.map(mesh=>Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;}));
    frozen.position.set(99,99,99); // Independent captured presentation, not a live role hierarchy.
    burst.update(100+timing.shatterMs+(timing.totalMs-timing.shatterMs)*.5);
    for(const [shape,mesh] of burst.meshes.entries())for(let i=0;i<mesh.count;i++){
      const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);
      const before=new THREE.Vector3().setFromMatrixPosition(starts[shape][i]),now=new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(now.y).toBeGreaterThan(before.y);expect(now.y).toBeLessThan(0);
      expect(now.distanceTo(before)).toBeLessThan(timing.spread*1.1);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).distanceTo(new THREE.Vector3().setFromMatrixScale(starts[shape][i]))).toBeLessThan(.000001);
      expect(mesh.geometry.getAttribute('shatterFade').getX(i)).toBeCloseTo(.5);
      const color=new THREE.Color();mesh.getColorAt(i,color);expect(SHATTER_COLORS).toContain('#'+color.getHexString());
    }
    expect(shatterDirection(42,0)).toEqual(shatterDirection(42,0));
    burst.update(100+timing.totalMs);expect(burst.meshes.every(mesh=>mesh.count===0&&!mesh.visible)).toBe(true);
    burst.dispose();expect(scene.children).toHaveLength(0);
  }
});
it('bounds both shape batches together to 384 slots, including 48 simultaneous mixed deaths and circular reuse', () => {
  const scene=new THREE.Scene(),burst=new EnemyShatterBurst(scene),group=new THREE.Group();group.add(new THREE.Group(),new THREE.Group());
  expect(burst.meshes.reduce((sum,mesh)=>sum+mesh.instanceMatrix.count,0)).toBe(SHATTER_CAPACITY);
  for(let id=0;id<48;id++)burst.spawn(id,(['grunt','heavy','giant'] as const)[id%3],group,0);
  burst.update(250);expect(burst.meshes.reduce((sum,mesh)=>sum+mesh.count,0)).toBe(384);
  for(let id=48;id<144;id++)burst.spawn(id,'grunt',group,1000);
  burst.update(1110);expect(burst.meshes.map(mesh=>mesh.count)).toEqual([240,144]);
  expect(scene.children).toHaveLength(2);
  const disposals=burst.meshes.flatMap(mesh=>[vi.spyOn(mesh.geometry,'dispose'),vi.spyOn(mesh.material as THREE.Material,'dispose')]);
  burst.reset();expect(burst.meshes.every(mesh=>mesh.count===0&&!mesh.visible)).toBe(true);
  burst.dispose();expect(disposals.every(spy=>spy.mock.calls.length===1)).toBe(true);expect(scene.children).toHaveLength(0);
});
