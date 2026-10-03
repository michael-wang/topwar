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

// Sparse little blossoms dispersed over a vine-sized card, not one large
// flower-shaped solid. Each blossom is far smaller than a soldier helmet.
export function flowerSpeckTexture(): THREE.DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  const color = new THREE.Color(ART.coastalDefense.flower).convertLinearToSRGB();
  const centers = Array.from({ length: 11 }, (_, i) => ({
    x: .5 + Math.cos(i * 2.399963) * (.15 + i * .022),
    y: .5 + Math.sin(i * 2.399963) * (.13 + i * .026),
  }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let alpha = 0;
    for (const center of centers) for (let petal = 0; petal < 4; petal++) {
      const angle = petal * Math.PI / 2;
      const dx = (x + .5) / size - center.x - Math.cos(angle) * .013;
      const dy = (y + .5) / size - center.y - Math.sin(angle) * .013;
      alpha = Math.max(alpha, THREE.MathUtils.clamp((.016 - Math.hypot(dx, dy)) * 220, 0, 1));
    }
    const at = (y * size + x) * 4;
    data[at] = Math.round(color.r * 255); data[at + 1] = Math.round(color.g * 255);
    data[at + 2] = Math.round(color.b * 255); data[at + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true; return texture;
}
