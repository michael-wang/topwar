import * as THREE from 'three';
import {smokeWindX} from '../presentation/BattlefieldWind';

// Presentation tiers only: never use these footprints for damage or warnings.
export const EXPLOSION_SMOKE = {
  artillery: {count:12, dark:4, seconds:1.8, opacity:.40, airyWeight:.24, darkFadeEnd:.95},
  grenade: {count:16, dark:5, seconds:1.9, opacity:.30, airyWeight:.09},
  airstrike: {count:20, dark:6, seconds:5.6, opacity:.21, airyWeight:.10},
} as const;
type SmokeProfile = typeof EXPLOSION_SMOKE[keyof typeof EXPLOSION_SMOKE];

/** One bounded instanced draw, with a denser compact core and airy outer lobes. */
export function explosionSmokeGeometry(sphere: THREE.SphereGeometry, profile: SmokeProfile): THREE.SphereGeometry {
  const geometry=sphere.clone(), weights=new Float32Array(profile.count);
  for(let i=0;i<profile.count;i++)weights[i]=i<profile.dark?1:profile.airyWeight;
  geometry.setAttribute('smokeWeight',new THREE.InstancedBufferAttribute(weights,1));
  return geometry;
}
export function prepareExplosionSmoke(mesh: THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>, profile: SmokeProfile) {
  const age={value:0},color=new THREE.Color();
  const darkFadeEnd = 'darkFadeEnd' in profile ? profile.darkFadeEnd : .72;
  for(let i=0;i<profile.count;i++)mesh.setColorAt(i,color.set(i<profile.dark?'#45494c':'#b8bab9'));
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.smokeAge=age;
    shader.vertexShader=`attribute float smokeWeight; varying float vSmokeWeight;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSmokeWeight = smokeWeight;');
    shader.fragmentShader=`uniform float smokeAge; varying float vSmokeWeight;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',`#include <map_fragment>\ndiffuseColor.a *= vSmokeWeight * mix(1., clamp((${profile.seconds*darkFadeEnd}-smokeAge)/${profile.seconds*.36},0.,1.), step(.5,vSmokeWeight));`);
  };
  mesh.material.customProgramCacheKey=()=>`explosion-smoke-${profile.seconds}`;
  return age;
}
/** Writes into the caller's retained transform; all three tiers share shape and wind. */
export function poseExplosionSmoke(pose: THREE.Object3D, i:number, dark:boolean, age:number, radius:number, x:number, z:number):void {
  const grow=Math.max(0,age-.08),angle=i*2.399963229728653;
  const distance=radius*(dark?.075+grow*.05:.15+grow*.09);
  pose.position.set(x+smokeWindX(grow,dark)+Math.cos(angle)*distance,
    .4+i%3*.22+grow*(dark?.65:1),z+Math.sin(angle)*distance);
  const size=radius*(dark?.13+grow*.07:.28+grow*.085);
  pose.scale.set(size*(.9+i%3*.09),size*(dark?.85:1.08),size*(.85+i%2*.13));
  pose.rotation.set(i,angle,grow*.06);pose.updateMatrix();
}
export function explosionSmokeOpacity(age:number, profile:SmokeProfile):number {
  return Math.max(0,Math.min(1,(age-.08)/.22))*profile.opacity*Math.max(0,Math.min(1,(profile.seconds-age)/(profile.seconds*.4)));
}
