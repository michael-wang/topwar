import type { MeshStandardMaterial } from 'three';
import { ART } from '../../art/ArtDirection';

// Broad, world-anchored tonal washes: no geometry, particles, collision or clock.
// This stays beneath the existing red/cyan lane overlays and combat shadows.
export function coastalSand(material: MeshStandardMaterial): void {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => key + '|aegean-sand-v1';
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = 'varying vec2 beachPoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      'beachPoint = (modelMatrix * vec4(transformed, 1.)).xz;\n#include <project_vertex>');
    shader.fragmentShader = 'varying vec2 beachPoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float dune = sin(beachPoint.y*.22 + sin(beachPoint.x*.36)*1.4);
      float sandWash = sin(beachPoint.x*.49 + beachPoint.y*.13)*.065 + dune*.05;
      float nearShore = smoothstep(${ART.coastalDefense.shorelineZ - 13}.,${ART.coastalDefense.shorelineZ}.,
        beachPoint.y + sin(beachPoint.x*.24)*1.2);
      float fineRidge = pow(.5+.5*sin(beachPoint.y*2.1 + sin(beachPoint.x*.7)*.8), 4.);
      diffuseColor.rgb *= vec3(1.03,1.01,.97) + sandWash;
      diffuseColor.rgb *= mix(vec3(1.), vec3(.78,.87,.91), nearShore*.85);
      diffuseColor.rgb *= 1. - fineRidge*.055*(1.-nearShore);
    `);
  };
}
