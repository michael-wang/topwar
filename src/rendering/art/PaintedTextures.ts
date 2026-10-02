import * as THREE from 'three';

// Soft-edged, asymmetric brush daub shared across data-driven corridors.
export function paintDaubTexture(): THREE.DataTexture {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + .5) / size * 2 - 1, py = (y + .5) / size * 2 - 1;
    const edge = 1 - Math.sqrt((px + .06 * Math.sin(py * 8)) ** 2 + (py * .92) ** 2);
    const alpha = Math.max(0, Math.min(1, edge * 5)) * (.73 + .18 * Math.sin(py * 13 + px * 3));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

// Low-frequency ochre/cream washes, not high-frequency grain. Clamp before byte
// conversion so the bright wash cannot wrap into an unrelated saturated color.
export function sandWashTexture(): THREE.DataTexture {
  const width = 128, height = 256, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x / width, py = y / height;
    const wash = Math.sin(px * 19 + Math.sin(py * 8) * 2) * .035 + Math.cos(py * 24 + px * 3) * .03;
    const i = (y * width + x) * 4;
    data[i] = Math.min(255, Math.round(248 + wash * 180));
    data[i + 1] = Math.min(255, Math.round(239 + wash * 190));
    data[i + 2] = Math.min(255, Math.round(218 + wash * 210)); data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
