import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

type Surface = 'world' | 'ground' | 'player' | 'enemy';
type PaintHook = THREE.MeshStandardMaterial['onBeforeCompile'] & { illustrated?: boolean };
// Broad tonal strokes and matte warm/cool lighting, not texture noise or a postprocess.
// Composes with the player's existing limb shader and keeps instanced crowd batches.
export function illustratedMaterial(material: THREE.MeshStandardMaterial, surface: Surface = 'world'): THREE.MeshStandardMaterial {
  const before = material.onBeforeCompile as PaintHook;
  if (before.illustrated) return material;
  const key = material.customProgramCacheKey();
  material.roughness = 1; material.metalness = 0;
  const cloth = new THREE.Color(surface === 'player' ? ART.faction.player : ART.faction.grunt);
  const hook: PaintHook = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <project_vertex>', 'vPaintPosition = transformed;\n#include <project_vertex>');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${(surface === 'player' || surface === 'enemy') ? `#ifdef USE_MAP
          // The original tunic atlas island; keep face/leather and baked geometry intact.
          if (abs(vMapUv.x - .96875) < .009 && vMapUv.y > .77) {
            float clothValue = clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*2.6,.65,1.22);
            diffuseColor.rgb = vec3(${cloth.r.toFixed(6)},${cloth.g.toFixed(6)},${cloth.b.toFixed(6)})*clothValue;
          }
        #endif` : ''}
        float wash = sin(vPaintPosition.y*${surface === 'ground' ? '.12' : '3.1'} + vPaintPosition.x*${surface === 'ground' ? '.24' : '1.7'} + sin(vPaintPosition.z*1.3)*.6);
        diffuseColor.rgb *= .96 + .055*wash;
      `);
  };
  hook.illustrated = true; material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => `${key}|illustrated-${surface}-v1`;
  return material;
}
