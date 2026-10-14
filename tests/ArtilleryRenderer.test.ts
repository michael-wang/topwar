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

it('fills the true elapsed proportion inward while retaining the collision boundary', () => {
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
    const fill=danger.geometry.getAttribute('warningFillProgress');
    expect(fill.getX(0)).toBeCloseTo(time/pair[0].flightSeconds);
    expect(scene.getObjectByName('artillery-lane-outline')).toBeUndefined();
    expect(scene.getObjectByName('artillery-lane-glyph')).toBeUndefined();
    for(let i=0;i<2;i++){danger.getMatrixAt(i,matrix);
      const tip=new THREE.Vector3(0,-.42,0).applyMatrix4(matrix);
      expect(tip.x).toBeCloseTo(-pair[i].target.x);expect(tip.y).toBeCloseTo(pair[i].target.y);expect(tip.z).toBeCloseTo(pair[i].target.z);}
    expect(scene.getObjectByName('artillery-lock-on')!.visible).toBe(false);
    for(let i=0;i<8;i++)expect(scene.getObjectByName(`enemy-shell-warning-${i}`)!.visible).toBe(false);
  }
  r.update({shells:pair,elapsedSeconds:1,warningPresentation:'overheadLanes'},1000,{x:2.8,z:0},camera);
  danger.getMatrixAt(0,matrix);const fixed=matrix.toArray(),fill=danger.geometry.getAttribute('warningFillProgress').getX(0);
  r.update({shells:pair,elapsedSeconds:1,warningPresentation:'overheadLanes'},9000,{x:-2.8,z:0},camera);
  danger.getMatrixAt(0,matrix);expect(matrix.toArray()).toEqual(fixed); // Paused simulation freezes the pulse too.
  expect(danger.geometry.getAttribute('warningFillProgress').getX(0)).toBe(fill);
  r.update({shells:[],elapsedSeconds:3,warningPresentation:'overheadLanes'},9001);expect(danger.count).toBe(0);r.dispose();
  expect(scene.children).toHaveLength(0);
});

it('coalesces same-lane shells until the final resolution; cancellation/restore neither leaves markers nor replays flashes',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene),camera=warningCamera();
  const first={...shell,radius:.3},second={...shell,id:2,launchedAtSeconds:.3,impactAtSeconds:shell.impactAtSeconds+.3};
  const state={shells:[first,second],elapsedSeconds:.31,warningPresentation:'overheadLanes' as const};
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const fill=mesh.geometry.getAttribute('warningFillProgress');
  r.restore(state);r.update(state,0,{x:0,z:0},camera);expect(r.getDebugStats().warnings).toBe(1);
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(.75); // Earliest shell also owns its radius.
  expect(fill.getX(0)).toBeCloseTo(.31/first.flightSeconds);
  expect(scene.getObjectByName('enemy-cannon-flash-1')!.visible).toBe(false);
  r.update({...state,shells:[second],elapsedSeconds:first.impactAtSeconds},1000,{x:0,z:0},camera);expect(r.getDebugStats().warnings).toBe(1);
  expect(fill.getX(0)).toBeCloseTo((first.impactAtSeconds-second.launchedAtSeconds)/second.flightSeconds);
  mesh.getMatrixAt(0,matrix);const scale=new THREE.Vector3().setFromMatrixScale(matrix);
  expect(scale.x).toBeCloseTo(scale.y); // The later shell restores its full-width body, including pulse.
  r.update({...state,shells:[],elapsedSeconds:first.impactAtSeconds+.1},1000);expect(r.getDebugStats().warnings).toBe(0);
  r.reset();expect(r.getDebugStats().warnings).toBe(0);r.dispose();
});

it.each([350,390])('fits every overhead lane including its directional edge inside the %ipx mobile frame',width=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene),camera=new THREE.PerspectiveCamera(coastalCameraFov(width/844),width/844,.1,180);
  camera.position.set(0,6.5,-10);camera.lookAt(0,0,12.5);camera.updateMatrixWorld();
  const all=Array.from({length:5},(_,lane)=>makeArtilleryShell(lane+1,{source:shell.source},lane,[-2.8,-1.4,0,1.4,2.8],0,0,artilleryDefaults,.588));
  const ink=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh,matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for (const seconds of [0, 1, all[0].impactAtSeconds - .1291666667]) {
    r.update({shells:all,elapsedSeconds:seconds,warningPresentation:'overheadLanes'},1000,{x:0,z:0},camera);
    expect(ink.count).toBe(5);
    for(let i=0;i<ink.count;i++){
      ink.getMatrixAt(i,matrix);
      const tip=new THREE.Vector3(0,-.42,0).applyMatrix4(matrix);
      expect(tip.x).toBeCloseTo(-all[i].target.x);expect(tip.y).toBeCloseTo(all[i].target.y);expect(tip.z).toBeCloseTo(all[i].target.z);
      for(const x of [-2.8,-1.4,0,1.4,2.8])expect(artilleryHits(all[i],x,0)).toBe(x===all[i].target.x);
      for(let v=0;v<ink.geometry.attributes.position.count;v++){
        point.fromBufferAttribute(ink.geometry.attributes.position,v);
        const lean=ink.geometry.getAttribute('warningLean').getX(i),accent=ink.geometry.getAttribute('warningAccent');
        point.x+=lean*(accent.getW(v)>.5&&accent.getX(v)<.01?.55:(point.y+.42)/.78);point.applyMatrix4(matrix).project(camera);
        expect((point.x*.5+.5)*width).toBeGreaterThan(0);expect((point.x*.5+.5)*width).toBeLessThan(width);
        const target=new THREE.Vector3(-all[i].target.x,all[i].target.y,all[i].target.z).project(camera);
        expect((.5-point.y*.5)*844).toBeGreaterThan(550);expect(point.y).toBeGreaterThanOrEqual(target.y-1e-6);
        const a=new THREE.Vector3(-all[i].target.x-all[i].radius,0,0).project(camera).x;
        const b=new THREE.Vector3(-all[i].target.x+all[i].radius,0,0).project(camera).x;
        expect(point.x).toBeGreaterThanOrEqual(Math.min(a,b)-1e-6);expect(point.x).toBeLessThanOrEqual(Math.max(a,b)+1e-6);
      }
    }
  }
  r.dispose();
});

it('escalates independent lane pulses near impact and freezes/restores them with simulation time',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene);
  const pair=[{...shell,targetLane:0,target:{...shell.target,x:-2.8},launchedAtSeconds:0,impactAtSeconds:2},
    {...shell,id:2,targetLane:1,target:{...shell.target,x:-1.4},launchedAtSeconds:1,impactAtSeconds:3}];
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4(),fill=mesh.geometry.getAttribute('warningFillProgress');
  r.update({shells:pair,elapsedSeconds:1.9,warningPresentation:'overheadLanes'},1900);
  expect(fill.getX(0)).toBeCloseTo(.95);expect(fill.getX(1)).toBeCloseTo(.45);
  mesh.getMatrixAt(0,matrix);const punch=new THREE.Vector3().setFromMatrixScale(matrix).x;
  const pausedMatrix=matrix.toArray();
  r.update({shells:pair,elapsedSeconds:1.9,warningPresentation:'overheadLanes'},9000);mesh.getMatrixAt(0,matrix);
  expect(matrix.toArray()).toEqual(pausedMatrix);expect(fill.getX(0)).toBeCloseTo(.95);
  r.update({shells:pair,elapsedSeconds:1.95,warningPresentation:'overheadLanes'},9050);
  expect(fill.getX(0)).toBeCloseTo(.975);
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

it('preallocates one inward-fill shader and keeps red and black fully visible throughout flight',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene);
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const attribute=mesh.geometry.getAttribute('warningFillProgress'),material=mesh.material as THREE.MeshBasicMaterial;
  expect(attribute.count).toBe(8);expect(mesh.instanceColor).toBeNull();
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
  material.onBeforeCompile(shader as any,{} as any);
  expect(shader.vertexShader).toContain('vWarningFillProgress = warningFillProgress');
  expect(shader.vertexShader).toContain('vWarningAccent = warningAccent');
  expect(shader.vertexShader).toContain('vWarningBarycentric = warningBarycentric');
  expect(shader.fragmentShader).toContain('mix(diffuseColor.rgb, vWarningAccent.rgb, vWarningAccent.a)');
  expect(shader.fragmentShader).toContain('(1.0 - sqrt(1.0 - vWarningFillProgress)) / 3.0');
  expect(shader.fragmentShader).toContain('if (vWarningAccent.a < 0.5 && edgeDistance > inset) discard');
  for(const progress of [0,.25,.5,.9,.99,1]){
    const time=shell.launchedAtSeconds+(shell.impactAtSeconds-shell.launchedAtSeconds)*progress;
    r.update({shells:[shell],elapsedSeconds:time,warningPresentation:'overheadLanes'},0);
    expect(attribute.getX(0)).toBeCloseTo(progress);
    expect(mesh.geometry.getAttribute('warningFillProgress')).toBe(attribute);
    expect(material.color.getHexString()).toBe('ff1000');expect(material.opacity).toBe(1);
  }
  r.dispose();
});

it('merges the downward triangle, thin rim and solid black exclamation into one owned lane batch',()=>{
  const scene=new THREE.Scene(),r=new EnemyArtilleryRenderer(scene);
  const mesh=scene.getObjectByName('artillery-lane-danger') as THREE.InstancedMesh;
  const positions=mesh.geometry.getAttribute('position'),accents=mesh.geometry.getAttribute('warningAccent');
  const barycentric=mesh.geometry.getAttribute('warningBarycentric');
  expect(accents.count).toBe(positions.count);
  const body=[] as THREE.Vector3[],rim=[] as THREE.Vector3[],glyph=[] as THREE.Vector3[];
  for(let i=0;i<positions.count;i++) {
    const p=new THREE.Vector3().fromBufferAttribute(positions,i);
    if(accents.getW(i)===0){
      const bary=new THREE.Vector3().fromBufferAttribute(barycentric,i);
      expect(bary.toArray().sort()).toEqual([0,0,1]);
    }else{
      const accent=new THREE.Color(accents.getX(i),accents.getY(i),accents.getZ(i));
      expect(['ff1000','000000']).toContain(accent.getHexString());
    }
    (accents.getW(i)===0?body:accents.getX(i)===0?glyph:rim).push(p);
  }
  expect(body).toHaveLength(3);expect(glyph.length).toBeGreaterThan(3);expect(rim.length).toBeGreaterThan(3);
  const tip=body.reduce((a,b)=>a.y<b.y?a:b);
  expect(tip.x).toBe(0);expect(tip.y).toBeCloseTo(-.385);
  expect(Math.max(...body.map(p=>p.x))).toBeCloseTo(.375);
  expect(Math.max(...rim.map(p=>p.x))).toBeCloseTo(.40);
  expect(rim.find(p=>Math.abs(p.x+.40)<1e-6)!.y).toBeCloseTo(.35);
  expect(rim.find(p=>Math.abs(p.x-.40)<1e-6)!.y).toBeCloseTo(.36); // Authored uneven upper corners.
  expect(rim.find(p=>Math.abs(p.x-.225)<1e-6)!.y).toBeCloseTo(-.01); // Slightly bowed edge, same footprint.
  expect(scene.getObjectByName('artillery-lane-outline')).toBeUndefined();
  expect(scene.getObjectByName('artillery-lane-glyph')).toBeUndefined();
  let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);
  r.dispose();expect(disposed).toBe(1);expect(scene.children).toHaveLength(0);
});
