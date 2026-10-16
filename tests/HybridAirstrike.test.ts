import {expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {HeavyAirstrikeExplosion} from '../src/rendering/HeavyAirstrikeExplosion';
import {ExplosionComparison,COMPARISON_IMPACTS} from '../src/dev/ExplosionComparison';

it('matches accepted Hybrid D matrices, colors and independent ages across the full multi-impact timeline',()=>{
 const scene=new THREE.Scene(),reference=new THREE.Scene(),fx=new HeavyAirstrikeExplosion(scene),lab=new ExplosionComparison(reference,'airstrike','D');
 COMPARISON_IMPACTS.forEach((e,i)=>fx.present(i,e.x,e.z,e.at));
 const smoke=scene.getObjectByName('airstrike-smoke') as THREE.InstancedMesh;
 const matrix=new THREE.Matrix4(),other=new THREE.Matrix4(),color=new THREE.Color(),expected=new THREE.Color();
 for(const ms of [30,180,450,900,1500,1800,2000,2500,4000,5100]){
  fx.update(ms,0);lab.seek(ms);
  const active=COMPARISON_IMPACTS.map((e,i)=>({e,i})).filter(({e})=>ms>=e.at&&ms-e.at<2000).sort((a,b)=>b.e.z-a.e.z||b.e.at-a.e.at);
  expect(smoke.count).toBe(active.length*16);expect(smoke.visible).toBe(active.length>0);
  active.forEach(({i},packed)=>{
   for(let band=0;band<3;band++){
    const original=reference.getObjectByName(`lab-${i}-band-${band}`) as THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    for(let lobe=0;lobe<8;lobe++){
     const target=(band===0?scene.getObjectByName(`airstrike-outer-${i}`):smoke) as THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
     const index=band===0?lobe:(band-1)*active.length*8+packed*8+lobe;
     target.getMatrixAt(index,matrix);original.getMatrixAt(lobe,other);expect(matrix.elements).toEqual(other.elements);
     target.getColorAt(index,color);color.multiply(target.material.color);original.getColorAt(lobe,expected);expected.multiply(original.material.color);
     color.toArray().forEach((v,j)=>expect(v).toBeCloseTo(expected.toArray()[j],6));
     expect(target.geometry.attributes.fxOpacity.getX(index)).toBeCloseTo(original.material.opacity,6);
    }
   }
   for(const [name,labName]of [['flash','flash'],['fire','fire'],['shockwave','shockwave']]){
    const mesh=scene.getObjectByName(name==='shockwave'?`airstrike-shockwave-${i}`:`airstrike-${name}`) as THREE.InstancedMesh;
    const original=reference.getObjectByName(`lab-${i}-${labName}`) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    const alpha=mesh.geometry.attributes.fxOpacity;
    const targetIndex=name==='shockwave'?0:i;
    if(!original.visible){expect(alpha.getX(name==='fire'?i*3:targetIndex)).toBe(0);continue;}
    if(original instanceof THREE.InstancedMesh){
     for(let j=0;j<3;j++){mesh.getMatrixAt(i*3+j,matrix);original.getMatrixAt(j,other);expect(matrix.elements).toEqual(other.elements);expect(alpha.getX(i*3+j)).toBeCloseTo(original.material.opacity,6);}
    }else{
     original.updateMatrix();mesh.getMatrixAt(targetIndex,matrix);matrix.elements.forEach((v,j)=>expect(v).toBeCloseTo(original.matrix.elements[j],6));expect(alpha.getX(targetIndex)).toBeCloseTo(original.material.opacity,6);
    }
    expect((mesh.material as THREE.MeshBasicMaterial).color).toEqual(original.material.color);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(original.geometry.attributes.position.array));
   }
  });
 }
 fx.dispose();lab.dispose();expect(scene.children.length+reference.children.length).toBe(0);
});

it('retains all twelve anchors, later full lifetimes, bounded depth-sorted outer/ring views and exact cleanup',()=>{
 const scene=new THREE.Scene(),fx=new HeavyAirstrikeExplosion(scene),objects=[...scene.children];
 const smoke=scene.getObjectByName('airstrike-smoke') as THREE.InstancedMesh;
 const resources=new Set<THREE.BufferGeometry|THREE.Material>();
 for(const m of scene.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]){resources.add(m.geometry);resources.add(m.material);}
 const spies=[...resources].map(r=>vi.spyOn(r,'dispose'));
 fx.present(0,0,5,0);fx.present(9,0,5,1950);fx.update(1975,0);expect(smoke.count).toBe(32);
 fx.update(2000,0);expect(smoke.count).toBe(16);fx.update(3949,0);expect(smoke.visible).toBe(true);fx.update(3950,0);expect(smoke.visible).toBe(false);
 fx.reset();for(let i=0;i<12;i++)fx.present(i,i,14,0);
 fx.update(100,0);expect(smoke.count).toBe(192);expect(scene.children.filter(m=>m.visible)).toHaveLength(27);
 const frozen=Array.from(smoke.instanceMatrix.array);fx.update(100,0);expect(Array.from(smoke.instanceMatrix.array)).toEqual(frozen);expect(scene.children).toEqual(objects);
 fx.reset();expect(scene.children.every(m=>!m.visible)).toBe(true);fx.dispose();expect(scene.children).toHaveLength(0);spies.forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});
