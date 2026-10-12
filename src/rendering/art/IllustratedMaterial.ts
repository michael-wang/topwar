import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

type Surface = 'world' | 'ground';
type PaintHook = THREE.MeshStandardMaterial['onBeforeCompile'] & { illustrated?: boolean };
// Broad tonal strokes and matte warm/cool lighting, not texture noise or a postprocess.
// Current coastal scenery and naval materials share this bounded shader hook.
export function illustratedMaterial(material: THREE.MeshStandardMaterial, surface: Surface = 'world'): THREE.MeshStandardMaterial {
  const before = material.onBeforeCompile as PaintHook;
  if (before.illustrated) return material;
  const key = material.customProgramCacheKey();
  material.roughness = 1; material.metalness = 0;
  const hook: PaintHook = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <project_vertex>', 'vPaintPosition = transformed;\n#include <project_vertex>');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wash = sin(vPaintPosition.y*${surface === 'ground' ? '.12' : '3.1'} + vPaintPosition.x*${surface === 'ground' ? '.24' : '1.7'} + sin(vPaintPosition.z*1.3)*.6);
        diffuseColor.rgb *= .96 + .055*wash;
      `);
  };
  hook.illustrated = true; material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => `${key}|illustrated-${surface}-v2`;
  return material;
}
