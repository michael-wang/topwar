import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CoastalArchitecture } from '../src/rendering/environment/CoastalArchitecture';
import { ART } from '../src/art/ArtDirection';
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
