import { expect, it } from 'vitest';
import * as THREE from 'three';
import { EnemyArtilleryRenderer } from '../src/rendering/EnemyArtilleryRenderer';
import { makeArtilleryShell, sampleArtillery, artilleryHits } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
import { warningInnerRadius } from '../src/presentation/ArtilleryWarning';
import { GrenadeExplosion } from '../src/rendering/GrenadeExplosion';
import { coastalCameraFov } from '../src/rendering/renderSize';

function warningCamera(width=390) {
  const camera=new THREE.PerspectiveCamera(coastalCameraFov(width/844),width/844,.1,180);
  camera.position.set(0,6.5,-10);camera.lookAt(0,0,12.5);camera.updateMatrixWorld();return camera;
}

const shell = makeArtilleryShell(1, { source: { id: 'test', type: 'offshore', position: { x: -3, y: 1.2, z: 52 } } },
  2, [-2.8, -1.4, 0, 1.4, 2.8], 0, 0, artilleryDefaults, .588);
it('keeps shell/warning positions tied to authoritative flight and exact collision radius', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1000);
  const model = scene.getObjectByName('enemy-shell-0')!, warning = scene.getObjectByName('enemy-shell-warning-0')!;
  const p = sampleArtillery(shell, 1);
  expect(model.position.toArray()).toEqual([-p.x, p.y, p.z]);
  expect(warning.position.toArray()).toEqual([-shell.target.x, .035, shell.target.z]);
  expect(warning.scale.x).toBe(shell.radius);
  const pose = model.matrix.toArray(), direction = model.quaternion.toArray();
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1000);
  expect(model.matrix.toArray()).toEqual(pose); expect(model.quaternion.toArray()).toEqual(direction);
  r.update({ shells: [], elapsedSeconds: shell.impactAtSeconds }, 2200);
  expect(model.visible).toBe(false); expect(warning.visible).toBe(false);
  r.dispose(); expect(scene.children).toHaveLength(0);
});

it('keeps all resources bounded across repeated overlapping impacts, rewinds and resets', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  const resources = () => { const geometries = new Set(), materials = new Set(); let objects = 0;
    scene.traverse(o => { objects++; if (o instanceof THREE.Mesh) { geometries.add(o.geometry); materials.add(o.material); } });
    return { objects, geometries: geometries.size, materials: materials.size }; };
  const initial = resources();
  for (let cycle = 0; cycle < 40; cycle++) {
    const shells = Array.from({ length: 8 }, (_, i) => ({ ...shell, id: i + 1, launchedAtSeconds: cycle * 4,
      impactAtSeconds: cycle * 4 + shell.flightSeconds }));
    r.update({ shells, elapsedSeconds: cycle * 4 + 1 }, cycle * 4000 + 1000);
    expect(r.getDebugStats()).toMatchObject({ capacity: 8, shells: 8, warnings: 8 });
    r.present(shells.map(s => ({ kind: 'artilleryImpact', id: s.id, x: s.target.x, z: s.target.z,
      radius: s.radius, atSeconds: s.impactAtSeconds, hit: false })), cycle * 4000 + 2200);
    r.update({ shells: [], elapsedSeconds: cycle * 4 + 2.2 }, cycle * 4000 + 2250);
    expect(r.getDebugStats().impacts).toBe(8); expect(resources()).toEqual(initial);
    r.reset(); expect(r.getDebugStats()).toEqual({ capacity: 8, shells: 0, warnings: 0, impacts: 0 });
  }
  r.dispose(); expect(scene.children).toHaveLength(0);
});

it('preserves historical ground-ring fill and its exact collision boundary', () => {
  for (const progress of [0, .25, .5, .9, 1]) expect(1 - warningInnerRadius(progress) ** 2).toBeCloseTo(progress);
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.update({ shells: [shell], elapsedSeconds: shell.flightSeconds / 2 }, 500);
  const warning = scene.getObjectByName('enemy-shell-warning-0')!;
  const fill = warning.children[1] as THREE.Mesh;
  expect(fill.geometry.attributes.position.getX(0)).toBeCloseTo(Math.sqrt(.5));
  expect(warning.scale.x).toBe(shell.radius); expect(fill.material).toMatchObject({ depthTest: true });
  r.dispose();
});

it('refreshes one 450ms alert that follows the actual player and freezes with presentation time', () => {
  const scene = new THREE.Scene(), r = new EnemyArtilleryRenderer(scene);
  r.present([{ kind: 'artilleryLaunch', shell }], 1000);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1200, { x: 1.2, z: 0 });
  const alert = scene.getObjectByName('artillery-lock-on')!;
  expect(alert.visible).toBe(true); expect(alert.position.x).toBe(-1.2);
  const scale = alert.scale.x; r.update({ shells: [shell], elapsedSeconds: 1 }, 1200); expect(alert.scale.x).toBe(scale);
  r.present([{ kind: 'artilleryLaunch', shell }], 1300);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1700); expect(alert.visible).toBe(true);
  r.update({ shells: [shell], elapsedSeconds: 1 }, 1750); expect(alert.visible).toBe(false);
  r.reset(); expect(alert.visible).toBe(false); r.dispose();
});

it('omits persistent enemy-shell stains while preserving player Grenade stains', () => {
  const a = new GrenadeExplosion(new THREE.Scene(), 8, false), b = new GrenadeExplosion(new THREE.Scene());
  for (const r of [a, b]) { r.present(0, 0, .588, 0); r.update(1300, 0); }
  expect(a.activeScorches).toBe(0); expect(b.activeScorches).toBe(1); a.dispose(); b.dispose();
});

it('shows continuously visible lane-locked overhead warnings for the complete flight without any ground/global warning',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene),camera=warningCamera();
  const pair=[makeArtilleryShell(1,{source:shell.source},1,[-2.8,-1.4,0,1.4,2.8],0,0,artilleryDefaults,.588),
    makeArtilleryShell(2,{source:shell.source},3,[-2.8,-1.4,0,1.4,2.8],0,0,artilleryDefaults,.588)];
  const danger=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4();
  for(const time of [0,.45,1,Math.min(...pair.map(s=>s.impactAtSeconds))-.001]){
    r.update({shells:pair,elapsedSeconds:time,warningPresentation:'overheadLanes'},time*1000,{x:2.8,z:0},camera);
    expect(danger.visible).toBe(true);expect(danger.count).toBe(2);expect(danger.material).toMatchObject({opacity:1,transparent:true});
    expect(scene.getObjectByName('artillery-lane-outline')).toBeUndefined();
    expect(scene.getObjectByName('artillery-lane-glyph')).toBeUndefined();
    for(let i=0;i<2;i++){danger.getMatrixAt(i,matrix);
      const center=new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(center.x).toBeCloseTo(-pair[i].target.x);expect(center.y).toBeCloseTo(2.05);expect(center.z).toBeCloseTo(pair[i].target.z);}
    expect(scene.getObjectByName('artillery-lock-on')!.visible).toBe(false);
    for(let i=0;i<8;i++)expect(scene.getObjectByName(`enemy-shell-warning-${i}`)!.visible).toBe(false);
  }
  r.update({shells:pair,elapsedSeconds:1,warningPresentation:'overheadLanes'},1000,{x:2.8,z:0},camera);
  danger.getMatrixAt(0,matrix);const fixed=matrix.toArray();
  r.update({shells:pair,elapsedSeconds:1,warningPresentation:'overheadLanes'},9000,{x:-2.8,z:0},camera);
  danger.getMatrixAt(0,matrix);expect(matrix.toArray()).toEqual(fixed); // Paused simulation freezes the pulse too.
  r.update({shells:[],elapsedSeconds:3,warningPresentation:'overheadLanes'},9001);expect(danger.count).toBe(0);r.dispose();
  expect(scene.children).toHaveLength(0);
});

it('coalesces same-lane shells until the final resolution; cancellation/restore neither leaves markers nor replays flashes',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene),camera=warningCamera();
  const first={...shell,radius:.3},second={...shell,id:2,launchedAtSeconds:.3,impactAtSeconds:shell.impactAtSeconds+.3};
  const state={shells:[first,second],elapsedSeconds:.31,warningPresentation:'overheadLanes' as const};
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  r.restore(state);r.update(state,0,{x:0,z:0},camera);expect(r.getDebugStats().warnings).toBe(1);
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1); // Collision radius never resizes the marker.
  expect(scene.getObjectByName('enemy-cannon-flash-1')!.visible).toBe(false);
  r.update({...state,shells:[second],elapsedSeconds:first.impactAtSeconds},1000,{x:0,z:0},camera);expect(r.getDebugStats().warnings).toBe(1);
  mesh.getMatrixAt(0,matrix);const scale=new THREE.Vector3().setFromMatrixScale(matrix);
  expect(scale.x).toBeCloseTo(scale.y); // The later shell keeps its full-width body, including pulse.
  r.update({...state,shells:[],elapsedSeconds:first.impactAtSeconds+.1},1000);expect(r.getDebugStats().warnings).toBe(0);
  r.reset();expect(r.getDebugStats().warnings).toBe(0);r.dispose();
});

it.each([350,390])('keeps complete lane-aligned triangles with natural viewport clipping at %ipx',width=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene),camera=warningCamera(width);
  const cameraPose=camera.matrixWorld.toArray(),projection=camera.projectionMatrix.toArray();
  const all=Array.from({length:5},(_,lane)=>({...makeArtilleryShell(lane+1,{source:shell.source},lane,
    [-2.8,-1.4,0,1.4,2.8],0,0,artilleryDefaults,.588),flightSeconds:2.4,impactAtSeconds:2.4}));
  const ink=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh,matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  const geometry=ink.geometry,positions=geometry.attributes.position,vertices=Array.from(positions.array);
  expect(Math.min(...vertices.filter((_,i)=>i%3===0))).toBeCloseTo(-.4);
  expect(Math.max(...vertices.filter((_,i)=>i%3===0))).toBeCloseTo(.4);
  expect(geometry.getAttribute('warningLean')).toBeUndefined();
  for(const seconds of [0,1,2.4-.1291666667]){
    const state={shells:all,elapsedSeconds:seconds,warningPresentation:'overheadLanes' as const};
    r.update(state,seconds*1000,{x:0,z:0},camera);expect(ink.count).toBe(5);
    const matrices=[] as number[][];
    for(let i=0;i<ink.count;i++){
      ink.getMatrixAt(i,matrix);matrices.push(matrix.toArray());
      const center=new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(center.x).toBeCloseTo(-all[i].target.x);expect(center.y).toBeCloseTo(2.05);expect(center.z).toBeCloseTo(all[i].target.z);
      const scale=new THREE.Vector3().setFromMatrixScale(matrix);
      expect(scale.x).toBeCloseTo(scale.y);expect(scale.x).toBeCloseTo(scale.z);
      if(i>0)expect(scale.x).toBeCloseTo(new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(matrices[0])).x);
      expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(-all[i].target.x);
      for(const x of [-2.8,-1.4,0,1.4,2.8])expect(artilleryHits(all[i],x,0)).toBe(x===all[i].target.x);
      let left=Infinity,right=-Infinity;
      for(let v=0;v<positions.count;v++){
        point.fromBufferAttribute(positions,v).applyMatrix4(matrix).project(camera);
        left=Math.min(left,point.x);right=Math.max(right,point.x);
        expect((.5-point.y*.5)*844).toBeLessThan(650); // Above weapon/Grenade HUD.
      }
      if(i===0)expect(left).toBeLessThan(-1);
      if(i===4)expect(right).toBeGreaterThan(1); // Complete outer triangles extend outside the camera frame.
    }
    r.update(state,9000,{x:2.8,z:0},camera);
    for(let i=0;i<5;i++){ink.getMatrixAt(i,matrix);expect(matrix.toArray()).toEqual(matrices[i]);}
    r.restore(state);r.update(state,0,{x:0,z:0},camera);
    for(let i=0;i<5;i++){ink.getMatrixAt(i,matrix);expect(matrix.toArray()).toEqual(matrices[i]);}
    r.update({...state,elapsedSeconds:seconds+.02},20,{x:0,z:0},camera);
    for(let i=0;i<5;i++){
      ink.getMatrixAt(i,matrix);const center=new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(center.toArray()).toEqual([expect.closeTo(-all[i].target.x,5),expect.closeTo(2.05,5),expect.closeTo(all[i].target.z,5)]);
    }
    expect(ink.geometry).toBe(geometry);expect(Array.from(positions.array)).toEqual(vertices);
  }
  expect(camera.matrixWorld.toArray()).toEqual(cameraPose);expect(camera.projectionMatrix.toArray()).toEqual(projection);
  r.dispose();
});

it('escalates independent lane pulses near impact and freezes/restores them with simulation time',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene);
  const pair=[{...shell,targetLane:0,target:{...shell.target,x:-2.8},launchedAtSeconds:0,impactAtSeconds:2},
    {...shell,id:2,targetLane:1,target:{...shell.target,x:-1.4},launchedAtSeconds:1,impactAtSeconds:3}];
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4();
  r.update({shells:pair,elapsedSeconds:1.9,warningPresentation:'overheadLanes'},1900);
  mesh.getMatrixAt(1,matrix);const laterPulse=new THREE.Vector3().setFromMatrixScale(matrix).x;
  mesh.getMatrixAt(0,matrix);const punch=new THREE.Vector3().setFromMatrixScale(matrix).x;
  const pausedMatrix=matrix.toArray();expect(punch).toBeGreaterThan(laterPulse);
  r.update({shells:pair,elapsedSeconds:1.9,warningPresentation:'overheadLanes'},9000);mesh.getMatrixAt(0,matrix);
  expect(matrix.toArray()).toEqual(pausedMatrix);
  r.update({shells:pair,elapsedSeconds:1.95,warningPresentation:'overheadLanes'},9050);
  const scaleAt=(time:number)=>{r.update({shells:pair,elapsedSeconds:time,warningPresentation:'overheadLanes'},time*1000);
    mesh.getMatrixAt(0,matrix);return new THREE.Vector3().setFromMatrixScale(matrix).x;};
  expect(scaleAt(.9)).toBe(1); // More than one second remaining: quiet outline.
  const earlyPeak=scaleAt(Math.sqrt(1.5)),latePeak=scaleAt(Math.sqrt(3.5));
  expect(earlyPeak).toBeGreaterThan(1);expect(latePeak).toBeGreaterThan(earlyPeak+.2);
  expect(punch).toBeGreaterThan(earlyPeak);expect(scaleAt(2)).toBeCloseTo(1.1); // Final 150ms emphasis.
  r.restore({shells:pair,elapsedSeconds:1.9,warningPresentation:'overheadLanes'});
  scaleAt(1.9);expect(matrix.toArray()).toEqual(pausedMatrix);
  expect(mesh.material).toMatchObject({opacity:1,transparent:true});r.dispose();
});

it('keeps a transparent interior and matching solid-red glyph without fill geometry or custom shaders',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene);
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh,geometry=mesh.geometry;
  const material=mesh.material as THREE.MeshBasicMaterial,positions=geometry.getAttribute('position');
  const vertices=Array.from(positions.array),flat=new THREE.Mesh(geometry,material);
  const ray=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(flat);
  for(const time of [0,.5,1,shell.impactAtSeconds-.05]){
    r.update({shells:[shell],elapsedSeconds:time,warningPresentation:'overheadLanes'},time*1000);
    expect(ray(-.15,.1)).toHaveLength(0); // Open interior beside the glyph.
    expect(ray(0,.15).length).toBeGreaterThan(0);expect(ray(0,-.11).length).toBeGreaterThan(0); // Solid stem/dot.
    expect(geometry.getAttribute('warningFillProgress')).toBeUndefined();
    expect(geometry.getAttribute('warningAccent')).toBeUndefined();expect(geometry.getAttribute('warningBarycentric')).toBeUndefined();
    expect(Array.from(positions.array)).toEqual(vertices);
    expect(material.color.getHexString()).toBe('ff1000');expect(material.opacity).toBe(1);expect(mesh.instanceColor).toBeNull();
  }
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  const original={...shader};material.onBeforeCompile(shader as any,{} as any);expect(shader).toEqual(original);
  const points=Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i));
  expect(points.find(p=>Math.abs(p.x+.40)<1e-6)!.y).toBeCloseTo(.35);
  expect(points.find(p=>Math.abs(p.x-.40)<1e-6)!.y).toBeCloseTo(.36);
  expect(points.find(p=>Math.abs(p.x-.225)<1e-6)!.y).toBeCloseTo(-.01); // Approved irregular outline.
  expect(points.reduce((a,b)=>a.y<b.y?a:b).toArray()).toEqual([0,expect.closeTo(-.42),0]);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
  r.dispose();expect(disposed).toBe(1);expect(scene.children).toHaveLength(0);
});
