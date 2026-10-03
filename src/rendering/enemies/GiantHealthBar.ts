import * as THREE from 'three';
import { BAR_TEXTURE_LAYOUT } from '../art/FramedBarTextures';

export function giantFillEnd(fraction: number): number {
  const { width, trackInset } = BAR_TEXTURE_LAYOUT;
  return trackInset + (width - 1 - 2 * trackInset) * Math.max(0, Math.min(1, fraction));
}

// CPU counterpart of the shader's rounded inner-track clip, used by layout QA.
export function giantFillContains(x: number, y: number, fraction: number): boolean {
  const { width, height, radius, trackInset } = BAR_TEXTURE_LAYOUT;
  const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
  const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
  const distance = Math.min(x, width - 1 - x, y, height - 1 - y, radius - Math.hypot(dx, dy));
  return fraction > 0 && distance >= trackInset && x <= giantFillEnd(fraction);
}

// One reusable pooled SpriteMaterial. Heavy keeps its original sprite layout;
// Giant uses the full frame quad and clips in texture space, so rounded caps
// and border insets cannot grow outside the frame when the world width changes.
export function prepareGiantBarFill(material: THREE.SpriteMaterial) {
  const enabled = { value: 0 }, fraction = { value: 1 };
  const { width, height, radius, trackInset } = BAR_TEXTURE_LAYOUT;
  material.onBeforeCompile = shader => {
    shader.uniforms.giantBarEnabled = enabled;
    shader.uniforms.giantBarFraction = fraction;
    shader.fragmentShader = 'uniform float giantBarEnabled;\nuniform float giantBarFraction;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      if (giantBarEnabled > .5) {
        vec2 p = vMapUv * vec2(${width}.0, ${height}.0) - .5;
        vec2 edge = max(max(vec2(${radius}) - p,
          p - vec2(${width - 1 - radius}, ${height - 1 - radius})), vec2(0.0));
        float d = min(min(p.x, ${width - 1}.0 - p.x),
          min(min(p.y, ${height - 1}.0 - p.y), ${radius} - length(edge)));
        float end = ${trackInset} + ${width - 1 - 2 * trackInset} * clamp(giantBarFraction, 0.0, 1.0);
        diffuseColor.a *= smoothstep(${trackInset}, ${trackInset + 1}, d)
          * (1.0 - smoothstep(end - 1.0, end, p.x));
      }
    `);
  };
  material.customProgramCacheKey = () => 'rounded-giant-inner-track-v1';
  return { enabled, fraction };
}
