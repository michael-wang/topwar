import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DeathBurst, DEATH_FRAGMENT_CAPACITY, DEATH_FRAGMENT_LIFETIME_MS, deathFragmentVelocity } from '../src/rendering/enemies/DeathBurst';
import { PALE_DEATH_COLORS } from '../src/rendering/enemies/PaleDeathMaterial';
describe('pale enemy shatter', () => {
  it('uses repeatable ID velocities and only pale plaster colors regardless of tier', () => {
    expect(deathFragmentVelocity(42,0)).toEqual(deathFragmentVelocity(42,0));
    expect(deathFragmentVelocity(42,0)).not.toEqual(deathFragmentVelocity(42,1));
    const scene=new THREE.Scene(), a=new DeathBurst(scene), b=new DeathBurst(scene);
    a.spawn({id:42,tier:1,x:0,z:8,hp:0},110);b.spawn({id:42,tier:7,x:0,z:8,hp:0},110);
    a.update(180);b.update(180);
    expect(a.fragments.instanceMatrix.array).toEqual(b.fragments.instanceMatrix.array);
    const color=new THREE.Color();
    for(let i=0;i<6;i++){a.fragments.getColorAt(i,color);expect(PALE_DEATH_COLORS).toContain('#'+color.getHexString());}
    a.dispose();b.dispose();
  });
  it('uses six Grunt/eight Heavy pieces in one bounded mesh, scheduled after the pale beat', () => {
    const scene=new THREE.Scene(),burst=new DeathBurst(scene);
    burst.spawn({id:1,tier:1,x:0,z:8,hp:0},110);
    burst.spawn({id:2,tier:1,x:1,z:9,hp:0,archetype:'heavy'},110,.8);
    burst.update(109);expect(burst.fragments.visible).toBe(false);
    burst.update(110);expect(burst.fragments.count).toBe(14);
    for(let id=3;id<100;id++)burst.spawn({id,tier:1,x:0,z:id,hp:0,archetype:'heavy'},110,.8);
    burst.update(150);expect(burst.activeCount).toBe(DEATH_FRAGMENT_CAPACITY);
    expect(burst.fragments.count).toBe(DEATH_FRAGMENT_CAPACITY);expect(scene.children).toEqual([burst.fragments]);
    const material=burst.fragments.material as THREE.MeshStandardMaterial;
    expect(material.emissiveIntensity).toBe(0);expect(material.emissive.getHex()).toBe(0);
    expect(material.roughness).toBe(1);expect(material.map).toBeNull();
    burst.update(110+DEATH_FRAGMENT_LIFETIME_MS);expect(burst.activeCount).toBe(0);expect(burst.fragments.visible).toBe(false);
    burst.reset();expect(burst.fragments.count).toBe(0);
    const geometry=vi.spyOn(burst.fragments.geometry,'dispose'),dispose=vi.spyOn(material,'dispose'),instances=vi.spyOn(burst.fragments,'dispose');
    burst.dispose();expect(geometry).toHaveBeenCalledOnce();expect(dispose).toHaveBeenCalledOnce();expect(instances).toHaveBeenCalledOnce();expect(scene.children).toHaveLength(0);
  });
});
