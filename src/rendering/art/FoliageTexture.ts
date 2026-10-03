import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

// Overlapping oval brush masses form a scalloped, porous silhouette. Generated
// once, with no canvas, source images or per-frame texture work.
export function foliageMassTexture(): THREE.DataTexture {
  const width = 256, height = 128, data = new Uint8Array(width * height * 4);
  const dark = new THREE.Color(ART.coastalDefense.foliageDark).convertLinearToSRGB();
  const light = new THREE.Color(ART.coastalDefense.foliageLight).convertLinearToSRGB();
  const masses = Array.from({ length: 42 }, (_, i) => {
    const angle = i * 2.399963, radius = Math.sqrt((i + .5) / 42);
    return { x: Math.cos(angle) * radius * .77, y: Math.sin(angle) * radius * .64,
      rx: .12 + .045 * (1 + Math.sin(i * 1.73)), ry: .10 + .025 * (1 + Math.cos(i * 2.3)) };
  });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + .5) / width * 2 - 1, py = (y + .5) / height * 2 - 1;
    let edge = -1, shade = 0;
    for (let i = 0; i < masses.length; i++) {
      const m = masses[i], d = 1 - Math.hypot((px - m.x) / m.rx, (py - m.y) / m.ry);
      if (d > edge) { edge = d; shade = .24 + .42 * (Math.sin(i * 3.7) + 1) / 2 + .15 * py; }
    }
    const at = (y * width + x) * 4;
    data[at] = Math.round(255 * THREE.MathUtils.lerp(dark.r, light.r, shade));
    data[at + 1] = Math.round(255 * THREE.MathUtils.lerp(dark.g, light.g, shade));
    data[at + 2] = Math.round(255 * THREE.MathUtils.lerp(dark.b, light.b, shade));
    data[at + 3] = Math.round(255 * THREE.MathUtils.clamp(edge * 8, 0, 1));
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
