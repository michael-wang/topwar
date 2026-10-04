import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createChibiGiantFamily, createChibiHeavyFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { ENEMY_DEATH_DURATION_MS, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';

it('applies identical curves to all current roles and freezes scale/maul grip through ground fade', () => {
  for(const role of ['grunt','heavy','giant'] as const){
    const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()};
    const scene=new THREE.Scene(),renderer=new EnemyRenderer(scene,families);
    const enemy={id:2,tier:1,hp:1,archetype:role,x:0,z:12,visualScale:1.9};
    renderer.update([enemy],0);renderer.update([enemy],2000);renderer.update([],2010);
    const corpse=scene.getObjectByName(role==='giant'?'giant-assault-soldier':'enemy-pale-death-body')!;
    const scale=corpse.scale.clone(),weapon=corpse.getObjectByName('giant-maul');
    weapon?.updateMatrix();const grip=weapon?.matrix.clone();
    const snapshots: THREE.Vector3[]=[];
    for(const p of [0,.25,.5,.65,.75,.9,1]){
      const pose=enemyDeathPose(p*ENEMY_DEATH_DURATION_MS[role],ENEMY_DEATH_DURATION_MS[role]);
      renderer.update([],2010+p*ENEMY_DEATH_DURATION_MS[role]);
      expect(corpse.visible).toBe(pose.bodyVisible);expect(corpse.scale).toEqual(scale);
      if(p<1){
        const body=corpse.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
        expect(body.material.opacity).toBeCloseTo(pose.opacity);
        const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <color_fragment>'} as Parameters<typeof body.material.onBeforeCompile>[0];
        body.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
        expect(shader.uniforms.deathPale.value).toBeCloseTo(pose.gray);
        expect(body.material.emissiveIntensity).toBe(0);
        if(p>=.5){
          expect(corpse.rotation.x).toBeCloseTo(-80*Math.PI/180);
          const bounds=new THREE.Box3().setFromObject(corpse);expect(bounds.min.y).toBeGreaterThan(-.00001);
          snapshots.push(corpse.position.clone());
        }
        if(weapon){weapon.updateMatrix();expect(weapon.matrix.equals(grip!)).toBe(true);}
      }
    }
    expect(snapshots.every(position=>position.equals(snapshots[0]))).toBe(true);
    for(const name of ['enemy-pale-shatter','giant-armor-wreckage','giant-death-impact'])expect(scene.getObjectByName(name)).toBeUndefined();
    renderer.reset();renderer.update([enemy],4000);
    if(role==='giant')expect(corpse.visible).toBe(true);
    else {renderer.update([],4010);expect(corpse.visible).toBe(true);}
    renderer.dispose();for(const family of Object.values(families))family.dispose();
    expect(scene.children).toHaveLength(0);expect(enemy.hp).toBe(1);
  }
});
