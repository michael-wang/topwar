import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

export const BAR_TEXTURE_LAYOUT = { width: 256, height: 48,
  radius: 48 * ART.bar.cornerFraction, trackInset: 48 * .17 } as const;

// Shared frame artwork; callers may select a semantic palette and outer armor shape.
// No canvas, per-enemy textures or extra bar meshes.
type FrameColors = Record<'deep' | 'ink' | 'frame' | 'highlight' | 'shadow', string>;
export function framedBarTexture(fill = false, palette: FrameColors = ART.bar,
  artwork: 'rounded' | 'armor' = 'rounded'): THREE.DataTexture {
  const { width, height } = BAR_TEXTURE_LAYOUT, data = new Uint8Array(width * height * 4);
  const ink = new THREE.Color(palette.deep), frame = new THREE.Color(palette.frame);
  const light = new THREE.Color(palette.highlight), shadow = new THREE.Color(palette.shadow);
  const color = new THREE.Color(), track = new THREE.Color(palette.ink);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radius = BAR_TEXTURE_LAYOUT.radius;
    const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
    const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
    const distance = Math.min(x, width - 1 - x, y, height - 1 - y, radius - Math.hypot(dx, dy));
    let alpha = Math.max(0, Math.min(1, distance + .5));
    if (fill) color.setRGB(1, 1, 1).multiplyScalar(.78 + .22 * y / height);
    else if (distance < height * ART.bar.edgeFraction) color.copy(shadow);
    else if (distance < BAR_TEXTURE_LAYOUT.trackInset) color.copy(frame).lerp(light, y / height);
    else color.copy(ink).lerp(track, y / height * .4);
    // Alter only the outer plate. The original rounded inner track, HP mask and
    // fill texture remain byte-for-byte identical, including at 0/100% HP.
    if (!fill && artwork === 'armor' && distance < BAR_TEXTURE_LAYOUT.trackInset) {
      const right = width - 1 - x, bottom = height - 1 - y;
      const edge = Math.min(x, right, y, bottom, (x + y - 10) / Math.SQRT2,
        (right + y - 4) / Math.SQRT2, (x + bottom - 4) / Math.SQRT2,
        (right + bottom - 14) / Math.SQRT2);
      alpha = Math.max(0, Math.min(1, edge + .5));
      color.copy(shadow);
      if (edge >= 2 && edge < 5) color.copy(frame).lerp(light, y / height);
      // Two unequal stamped tabs, entirely outside the readable health track.
      if ((x >= 17 && x <= 29 && y >= height - 6 && y <= height - 3)
        || (right >= 6 && right <= 8 && y >= 18 && y <= 26)) color.copy(light);
    }
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
