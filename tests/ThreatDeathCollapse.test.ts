import * as THREE from 'three';
import { expect, it } from 'vitest';
import { THREAT_DEATH_COLLAPSE, threatCollapseProgress, giantMaulSettle } from '../src/presentation/ThreatDeathCollapse';
import { ENEMY_DEATH_TIMING, enemyBodyOpening, enemyDeathPose } from '../src/presentation/EnemyDeathTiming';
import { writeLethalRecoil, lethalRecoilPose, LETHAL_FOOT_PIVOT_Y } from '../src/rendering/enemies/EnemyLethalRecoil';
import { EnemyRenderer } from '../src/rendering/enemies/EnemyRenderer';
import { createChibiGruntFamily } from '../src/rendering/enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from '../src/rendering/enemies/ChibiThreatFamilies';
import { GiantRenderer } from '../src/rendering/enemies/GiantRenderer';
import { HeavyHitFeedback } from '../src/rendering/enemies/HeavyHitFeedback';

it('loses vertical support, reaches a held peak with no depth retreat, then separates within unchanged caps', () => {
  expect(THREAT_DEATH_COLLAPSE.heavy).toEqual({startMs:80,peakMs:350,holdEndMs:515,sinkUnits:.26,angleDegrees:29,compression:.10});
  expect(THREAT_DEATH_COLLAPSE.giant).toEqual({startMs:150,peakMs:750,holdEndMs:1050,sinkUnits:.40,angleDegrees:20,compression:.07});
  const capture=new THREE.Matrix4().makeTranslation(.3,.01,8),localPivot=new THREE.Vector3(0,LETHAL_FOOT_PIVOT_Y,0);
  for(const role of ['heavy','giant']as const){
    const t=THREAT_DEATH_COLLAPSE[role],clock=ENEMY_DEATH_TIMING[role];let drop=0;
    for(let age=0;age<=clock.totalMs;age+=10){
      const pose=lethalRecoilPose(age,role),matrix=new THREE.Matrix4();writeLethalRecoil(matrix,capture,age,role);
      expect(pose.sink).toBeGreaterThanOrEqual(drop);expect(pose.sink).toBeLessThanOrEqual(t.sinkUnits);drop=pose.sink;
      const pivot=localPivot.clone().applyMatrix4(matrix);expect(pivot.x).toBeCloseTo(.3);expect(pivot.z).toBeCloseTo(8);expect(pivot.y).toBeCloseTo(.05-pose.sink);
      // Shader restores only the shoe pieces by this exact world-Y correction.
      expect(pivot.y+pose.sink).toBeCloseTo(.05);new THREE.Vector3().setFromMatrixScale(matrix).toArray().forEach(value=>expect(value).toBeCloseTo(1));
      if(age<=t.peakMs)expect(enemyBodyOpening(age,role,enemyDeathPose(age,clock).breakup)).toBe(0);
      expect(enemyBodyOpening(age,role,enemyDeathPose(age,clock).breakup)).toBeLessThanOrEqual(clock.breakupDistance);
    }
    expect(threatCollapseProgress(t.startMs,role)).toBe(0);expect(threatCollapseProgress(t.peakMs,role)).toBe(1);
    expect(clock.breakupStartMs).toBe(t.holdEndMs);expect(clock.totalMs).toBe(role==='heavy'?1100:2600);
    const peak=new THREE.Matrix4();writeLethalRecoil(peak,capture,t.peakMs,role);
    for(let age=t.peakMs;age<=t.holdEndMs;age+=10){const held=new THREE.Matrix4();writeLethalRecoil(held,capture,age,role);expect(held.elements).toEqual(peak.elements);}
  }
  expect(THREAT_DEATH_COLLAPSE.giant.sinkUnits).toBeGreaterThan(THREAT_DEATH_COLLAPSE.heavy.sinkUnits);
  expect(THREAT_DEATH_COLLAPSE.giant.holdEndMs-THREAT_DEATH_COLLAPSE.giant.peakMs).toBe(300);
});
it('plants Heavy shoes in the existing bounded batch without changing simulation or borrowed geometry', () => {
  const families={grunt:createChibiGruntFamily(),heavy:createChibiHeavyFamily(),giant:createChibiGiantFamily()},scene=new THREE.Scene(),r=new EnemyRenderer(scene,families);
  const e={id:3,archetype:'heavy' as const,hp:1,tier:1,x:0,z:8},before=JSON.stringify(e),geometry=families.heavy.lethalReaction!.final.geometry;
  const positions=Array.from(geometry.getAttribute('position').array);
  r.update([e],2000,true);r.update([],2010,true);r.update([],2360,true);
  const body=scene.children.find(o=>o.name==='enemy-frozen-body-batch'&&o.visible&&(o as THREE.Mesh).geometry.getAttribute('deathPieceId').array.includes(8))as THREE.InstancedMesh;
  expect(body.count).toBe(1);expect(body.geometry.getAttribute('deathSink').getX(0)).toBeCloseTo(.26);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <color_fragment>'}as Parameters<THREE.Material['onBeforeCompile']>[0];
  (body.material as THREE.Material).onBeforeCompile(shader,{}as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain('isDeathFoot(deathPieceId, 1.)');expect(shader.vertexShader).toContain('viewMatrix * vec4(0., deathSink, 0., 0.)');
  expect(geometry.getAttribute('position').array).toEqual(new Float32Array(positions));expect(JSON.stringify(e)).toBe(before);
  r.reset();expect(body.count).toBe(0);r.dispose();Object.values(families).forEach(f=>f.dispose());expect(scene.children).toHaveLength(0);
});
it('drops the complete Giant maul and grip, settles them with a short lag and resets the death-only correction', () => {
  const f=createChibiGiantFamily(),scene=new THREE.Scene(),r=new GiantRenderer(scene,f),hits=new HeavyHitFeedback(scene),e={id:1,archetype:'giant' as const,hp:1,tier:1,x:0,z:8,visualScale:2.6};
  r.update(e,0,hits);r.update(e,2000,hits);const group=r.die(e,2010),weapon=group.getObjectByName('giant-maul')!,mesh=weapon.children[0]as THREE.Mesh;
  const original=Array.from(mesh.geometry.getAttribute('position').array),rest=mesh.position.clone();group.updateMatrixWorld(true);const aliveY=new THREE.Vector3().setFromMatrixPosition(weapon.matrixWorld).y;
  r.update(undefined,2760,hits);group.updateMatrixWorld(true);const droppedY=new THREE.Vector3().setFromMatrixPosition(weapon.matrixWorld).y;
  expect(droppedY).toBeLessThan(aliveY-.35);expect(mesh.position).toEqual(rest);expect(mesh.geometry.getAttribute('position').array).toEqual(new Float32Array(original));
  expect(weapon.children).toHaveLength(1);expect(weapon.parent).toBe(group);
  expect(giantMaulSettle(230)).toBe(0);expect(giantMaulSettle(750)).toBe(.50);expect(giantMaulSettle(2600)).toBe(.50);
  const mat=(group.children[0]as THREE.Mesh).material as THREE.Material,shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:''}as Parameters<THREE.Material['onBeforeCompile']>[0];mat.onBeforeCompile(shader,{}as THREE.WebGLRenderer);expect(shader.uniforms.deathSink.value).toBe(.40);
  r.update(undefined,2860,hits);const held=weapon.matrix.clone();r.update(undefined,2860,hits);expect(weapon.matrix.elements).toEqual(held.elements);
  r.reset();r.update(e,3000,hits);expect(shader.uniforms.deathSink.value).toBe(0);
  r.dispose();hits.dispose();f.dispose();expect(scene.children).toHaveLength(0);
});
