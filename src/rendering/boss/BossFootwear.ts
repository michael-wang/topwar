import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

// Narrow adapter for retained Boss atlas assets. Their lower leather island is
// footwear; the same swatch above the body is hair and must remain untouched.
export function prepareBossFootwear(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const before = material.onBeforeCompile as THREE.MeshStandardMaterial['onBeforeCompile'] & { footwear?: boolean };
  if (before.footwear) return material;
  const key = material.customProgramCacheKey();
  const color = new THREE.Color(ART.faction.shoes).toArray().map(v => v.toFixed(6)).join(',');
  const hook: typeof before = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBossShoe;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBossShoe = 0.;
        #ifdef USE_MAP
        vBossShoe = (1. - step(.009, abs(uv.x - .09375))) * (1. - step(.32, position.y));
        #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBossShoe;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${color}), vBossShoe);`);
  };
  hook.footwear = true; material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => `${key}|boss-light-footwear-v1`;
  return material;
}
