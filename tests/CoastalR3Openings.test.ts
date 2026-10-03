import * as THREE from 'three';
import { expect, it } from 'vitest';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';
import { CoastalArchitecture } from '../src/rendering/environment/CoastalArchitecture';
import { ART } from '../src/art/ArtDirection';

it('never shows the legacy warship in defense, retaining its activity and bridge occlusion in legacy', () => {
  const scene=new THREE.Scene(), environment=new BridgeEnvironment(scene);
  const ship=scene.getObjectByName('battlefield-warship')!;
  let legacyPass=false, planes=false, flak=false;
  for(let now=0;now<=120000;now+=100){
    environment.update(0,3.2,now,true);expect(ship.visible).toBe(false);
    planes ||= scene.getObjectsByProperty('name','battlefield-aircraft').some(x=>x.visible);
    flak ||= scene.getObjectsByProperty('name','battlefield-sky-flak-slot').some(x=>x.visible);
    environment.update(0,3.2,now,false);legacyPass ||= ship.visible;
    environment.update(0,3.2,now,true);expect(ship.visible).toBe(false);
  }
  expect(legacyPass).toBe(true);expect(planes).toBe(true);expect(flak).toBe(true);
  expect(scene.getObjectByName('offshore-troop-transports')).toBeDefined();
  environment.dispose();expect(scene.children).toHaveLength(0);
});
it('uses small secondary-shadow opening cores and cool plaster wall faces instead of deep navy slabs', () => {
  const architecture=new CoastalArchitecture();architecture.update(3.2);
  const dark=architecture.group.getObjectsByProperty('name','coastal-dark-forms') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
  expect(dark).toHaveLength(2);
  for(const mesh of dark){
    expect(mesh.material.color.getHexString()).toBe(ART.coastalDefense.secondaryShadow.slice(1));
    const p=mesh.geometry.getAttribute('position'),v=new THREE.Vector3(),u=new THREE.Vector3();
    // Every shadow-core triangle is opening-sized; old 1.44-high navy doors fail.
    for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
      v.fromBufferAttribute(p,i+j);u.fromBufferAttribute(p,i+(j+1)%3);
      expect(v.distanceTo(u)).toBeLessThan(1.25);
    }
  }
  const wall=architecture.group.getObjectByName('coastal-wallShadow-forms') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(wall.material.color.getHexString()).not.toBe(ART.coastalDefense.shadow.slice(1));
  expect(wall.material.color.r).toBeGreaterThan(new THREE.Color(ART.coastalDefense.secondaryShadow).r);
  expect(architecture.group.getObjectsByProperty('name','coastal-door-forms')).toHaveLength(2);
  architecture.dispose();
});
