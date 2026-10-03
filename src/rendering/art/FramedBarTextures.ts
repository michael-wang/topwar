import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

// Shared rounded frame geometry; callers may select a semantic frame palette.
// No canvas, per-enemy textures or extra bar meshes.
type FrameColors = Record<'deep' | 'ink' | 'frame' | 'highlight' | 'shadow', string>;
export function framedBarTexture(fill = false, palette: FrameColors = ART.bar): THREE.DataTexture {
  const width = 256, height = 48, data = new Uint8Array(width * height * 4);
  const ink = new THREE.Color(palette.deep), frame = new THREE.Color(palette.frame);
  const light = new THREE.Color(palette.highlight), shadow = new THREE.Color(palette.shadow);
  const color = new THREE.Color(), track = new THREE.Color(palette.ink);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radius = height * ART.bar.cornerFraction;
    const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
    const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
    const distance = Math.min(x, width - 1 - x, y, height - 1 - y, radius - Math.hypot(dx, dy));
    const alpha = Math.max(0, Math.min(1, distance + .5));
    if (fill) color.setRGB(1, 1, 1).multiplyScalar(.78 + .22 * y / height);
    else if (distance < height * ART.bar.edgeFraction) color.copy(shadow);
    else if (distance < height * .17) color.copy(frame).lerp(light, y / height);
    else color.copy(ink).lerp(track, y / height * .4);
    const i = (y * width + x) * 4;
    color.convertLinearToSRGB();
    data[i] = Math.round(color.r * 255); data[i + 1] = Math.round(color.g * 255);
    data[i + 2] = Math.round(color.b * 255); data[i + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
