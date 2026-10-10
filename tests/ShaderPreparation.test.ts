import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameRenderer } from '../src/rendering/GameRenderer';
import { unfoggedBasicMaterial } from '../src/rendering/art/unfoggedBasicMaterial';
import { SupplyCrateRenderer } from '../src/rendering/SupplyCrateRenderer';

it('skips speculative shader submission without nonblocking completion queries', () => {
  const compile=vi.fn(), renderer={extensions:{has:()=>false},compile};
  const steps=(GameRenderer.prototype as any).prepareObject.call({renderer},new THREE.Group());
  expect(steps.next().done).toBe(true);expect(compile).not.toHaveBeenCalled();
});
it('reflects uniforms only after a submitted shader reports ready', () => {
  const material=new THREE.MeshBasicMaterial(),getUniforms=vi.fn();
  const program={isReady:vi.fn().mockReturnValueOnce(false).mockReturnValue(true),getUniforms};
  const renderer={extensions:{has:()=>true},compile:vi.fn(()=>new Set([material])),properties:{get:()=>({currentProgram:program})}};
  const steps=(GameRenderer.prototype as any).prepareObject.call({renderer},new THREE.Group());
  steps.next();expect(renderer.compile).toHaveBeenCalledOnce();expect(getUniforms).not.toHaveBeenCalled();
  steps.next();expect(getUniforms).not.toHaveBeenCalled();steps.next();expect(getUniforms).toHaveBeenCalledOnce();
  steps.return();material.dispose();
});

it('shares the unmodified basic shader while disabling fog through stable uniforms', () => {
  const base=new THREE.MeshBasicMaterial({color:'#334455',transparent:true,opacity:.28,depthWrite:false});
  const material=unfoggedBasicMaterial({color:'#334455',transparent:true,opacity:.28,depthWrite:false});
  expect(material.customProgramCacheKey()).toBe(base.customProgramCacheKey());
  expect(material.color).toEqual(base.color);expect(material.opacity).toBe(base.opacity);
  expect(material.toneMapped).toBe(base.toneMapped);expect(material.depthWrite).toBe(base.depthWrite);
  const shader={uniforms:{},vertexShader:'unchanged vertex',fragmentShader:'unchanged fragment'} as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  shader.uniforms.fogNear.value=10;shader.uniforms.fogFar.value=200;
  expect(shader.uniforms.fogNear.value).toBe(1e20);expect(shader.uniforms.fogFar.value).toBe(2e20);
  expect(shader.vertexShader).toBe('unchanged vertex');expect(shader.fragmentShader).toBe('unchanged fragment');
  material.dispose();base.dispose();
});
it('retains separate opaque/fading crate resources and disposes the preparation materials', () => {
  const scene=new THREE.Scene(),crate=new SupplyCrateRenderer(scene),meshes=crate.preparationMeshes();
  let disposed=0;for(const mesh of meshes)(mesh.material as THREE.Material).addEventListener('dispose',()=>disposed++);
  expect(meshes.every(m=>(m.material as THREE.Material).transparent)).toBe(true);
  crate.present([{kind:'grenadeSupplyOpened',x:0,z:14,amount:3}],0);
  crate.update(undefined,100);const strap=scene.getObjectByName('crate-retaining-strap') as THREE.Mesh;
  expect((strap.material as THREE.Material).transparent).toBe(false);
  crate.update(undefined,1000);expect(strap.material).toBe(meshes[1].material);
  crate.reset();crate.dispose();expect(disposed).toBe(2);expect(scene.children).toHaveLength(0);
});
