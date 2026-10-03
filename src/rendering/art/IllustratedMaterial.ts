import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

type Surface = 'world' | 'ground' | 'player' | 'enemy' | 'weapon';
type PaintHook = THREE.MeshStandardMaterial['onBeforeCompile'] & { illustrated?: boolean };
// Broad tonal strokes and matte warm/cool lighting, not texture noise or a postprocess.
// Composes with the player's existing limb shader and keeps instanced crowd batches.
export function illustratedMaterial(material: THREE.MeshStandardMaterial, surface: Surface = 'world'): THREE.MeshStandardMaterial {
  const before = material.onBeforeCompile as PaintHook;
  if (before.illustrated) return material;
  const key = material.customProgramCacheKey();
  material.roughness = 1; material.metalness = 0;
  const cloth = new THREE.Color(surface === 'player' ? ART.faction.player : ART.faction.grunt);
  const rgb = (color: string) => new THREE.Color(color).toArray().map(value => value.toFixed(6)).join(',');
  const skin = rgb(ART.faction.skin), equipment = rgb(ART.faction.equipment), weapon = rgb(ART.faction.weapon);
  const lightCloth = rgb(surface === 'player' ? ART.faction.playerLight : ART.faction.gruntLight);
  const hook: PaintHook = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <project_vertex>', 'vPaintPosition = transformed;\n#include <project_vertex>');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;')
      .replace('#include <color_fragment>', `${surface === 'enemy' ? '' : '#include <color_fragment>'}
        ${(surface === 'player' || surface === 'enemy') ? `#ifdef USE_MAP
          // Remap the authored atlas swatches; all baked geometry/UVs remain intact.
          // Enemy instance color is a tunic palette, not a whole-body tint.
          if (abs(vMapUv.x - .96875) < .009 && vMapUv.y > .77) {
            float clothValue = clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*2.6,.65,1.22);
            vec3 clothColor = vec3(${cloth.r.toFixed(6)},${cloth.g.toFixed(6)},${cloth.b.toFixed(6)});
            #ifdef USE_INSTANCING_COLOR
            clothColor = vColor.rgb;
            #endif
            diffuseColor.rgb = mix(clothColor, vec3(${lightCloth}), max(0.,clothValue-1.)*.65)*clothValue;
          } else if (abs(vMapUv.x - .21875) < .009) {
            float skinValue = clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*2.6,.72,1.18);
            diffuseColor.rgb = vec3(${skin})*skinValue;
          } else if (abs(vMapUv.x - .34375) < .009) {
            diffuseColor.rgb = vec3(${weapon});
          } else if (abs(vMapUv.x - .09375) < .009 && vPaintPosition.y < .3) {
            // This swatch also contains hair; leave the upper head untouched.
            float equipmentValue = clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*5.,.7,1.18);
            diffuseColor.rgb = vec3(${equipment})*equipmentValue;
          }
        #endif` : ''}
        ${surface === 'weapon' ? `float metalValue = clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*4.,.75,1.25);
        diffuseColor.rgb = vec3(${weapon})*metalValue;` : ''}
        float wash = sin(vPaintPosition.y*${surface === 'ground' ? '.12' : '3.1'} + vPaintPosition.x*${surface === 'ground' ? '.24' : '1.7'} + sin(vPaintPosition.z*1.3)*.6);
        diffuseColor.rgb *= .96 + .055*wash;
      `);
  };
  hook.illustrated = true; material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => `${key}|illustrated-${surface}-v2`;
  return material;
}
