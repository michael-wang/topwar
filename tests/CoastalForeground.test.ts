import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { CoastalForeground, COASTAL_FOREGROUND_CLEARANCE } from '../src/rendering/environment/CoastalForeground';
import { BridgeEnvironment } from '../src/rendering/environment/BridgeEnvironment';

it('keeps every opaque foreground vertex outside track clearance, low and within the near beach at all track widths', () => {
  const foreground=new CoastalForeground(), vector=new THREE.Vector3();
  const meshes=foreground.group.children.flatMap(side=>side.children) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
  expect(meshes).toHaveLength(7);
  for(const halfWidth of [1.5,2.5,3.2,6]){
    foreground.update(halfWidth);foreground.group.updateMatrixWorld(true);
    for(const mesh of meshes){
      expect(mesh.material.map).toBeNull();expect(mesh.material.roughness).toBe(1);
      const p=mesh.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++){
        vector.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
        expect(Math.abs(vector.x)).toBeGreaterThanOrEqual(halfWidth+COASTAL_FOREGROUND_CLEARANCE);
        expect(vector.y).toBeLessThan(.75);expect(vector.z).toBeGreaterThan(5);expect(vector.z).toBeLessThan(17);
      }
    }
  }
  const geometry=meshes.map(mesh=>vi.spyOn(mesh.geometry,'dispose'));
  const materials=[...new Set(meshes.map(mesh=>mesh.material))].map(material=>vi.spyOn(material,'dispose'));
  expect(materials).toHaveLength(5);foreground.dispose();
  [...geometry,...materials].forEach(spy=>expect(spy).toHaveBeenCalledOnce());
});
it('owns foreground only through the defense beach and disposes its resources with the environment', () => {
  const scene=new THREE.Scene(), environment=new BridgeEnvironment(scene);
  const group=scene.getObjectByName('coastal-foreground-life')!;
  expect(group.parent?.name).toBe('stationary-defense-beach');
  const mesh=group.children[0].children[0] as THREE.Mesh;
  const geometry=vi.spyOn(mesh.geometry,'dispose'), material=vi.spyOn(mesh.material as THREE.Material,'dispose');
  environment.update(0,3.2,0,true);expect(group.parent!.visible).toBe(true);
  environment.update(0,3.2,1,false);expect(group.parent!.visible).toBe(false);
  environment.dispose();expect(geometry).toHaveBeenCalledOnce();expect(material).toHaveBeenCalledOnce();expect(scene.children).toHaveLength(0);
});
