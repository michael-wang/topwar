import * as THREE from 'three';

const TILE_WIDTH = 256, TILE_HEIGHT = 128, COUNT = 4;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const hash = (a: number, b: number) => {
    let bits = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    bits = Math.imul(bits ^ (bits >>> 13), 1274126177);
    return ((bits ^ (bits >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const u = smooth(x - ix), v = smooth(y - iy);
  const a = hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u;
  const b = hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u;
  return a * (1 - v) + b * v;
}

// Paint once on the CPU: irregular density, sunlit tops, cool soft undersides.
// These are flat cloud cards, not sphere assemblies or outlined sky icons.
export function coastalCloudTexture(): THREE.DataTexture {
  const width = TILE_WIDTH * COUNT, pixels = new Uint8Array(width * TILE_HEIGHT * 4);
  for (let tile = 0; tile < COUNT; tile++) {
    const density = new Float32Array(TILE_WIDTH * TILE_HEIGHT), seed = 713 + tile * 997;
    for (let y = 0; y < TILE_HEIGHT; y++) for (let x = 0; x < TILE_WIDTH; x++) {
      const u = x / (TILE_WIDTH - 1), v = y / (TILE_HEIGHT - 1), px = u * 2 - 1, py = v * 2 - 1;
      const turbulence = .55 * noise(u * 6, v * 5, seed) + .30 * noise(u * 15, v * 12, seed)
        + .15 * noise(u * 34, v * 29, seed);
      const base = Math.exp(-Math.pow(px * 1.7, 4) - Math.pow((py + .12) * 2.9, 2));
      const summit = Math.exp(-Math.pow((px + .20 - tile * .09) * 3.5, 2) - Math.pow((py - .16) * 3.2, 2));
      const shoulder = Math.exp(-Math.pow((px - .32) * 4.4, 2) - Math.pow((py - .02) * 4.8, 2));
      const edge = clamp(Math.min(u, 1 - u, v, 1 - v) * 22);
      density[y * TILE_WIDTH + x] = Math.max(0, (base + .65 * summit + .25 * shoulder
        - .38 + (turbulence - .5) * .72) * edge);
    }
    for (let y = 0; y < TILE_HEIGHT; y++) for (let x = 0; x < TILE_WIDTH; x++) {
      const value = density[y * TILE_WIDTH + x], offset = (y * width + tile * TILE_WIDTH + x) * 4;
      const slope = density[Math.min(TILE_HEIGHT - 1, y + 2) * TILE_WIDTH + x]
        - density[Math.max(0, y - 2) * TILE_WIDTH + x];
      const across = density[y * TILE_WIDTH + Math.min(TILE_WIDTH - 1, x + 2)]
        - density[y * TILE_WIDTH + Math.max(0, x - 2)];
      const nx = -across * 8, ny = -slope * 8;
      const light = clamp(.45 + .55 * (-nx * .45 + ny * .70 + .55) / Math.sqrt(nx * nx + ny * ny + 1));
      pixels[offset] = Math.round(194 + light * 61);
      pixels[offset + 1] = Math.round(209 + light * 46);
      pixels[offset + 2] = Math.round(220 + light * 35);
      const alpha = clamp(value * 4.3);
      pixels[offset + 3] = Math.round(alpha * alpha * (3 - 2 * alpha) * 240);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, TILE_HEIGHT, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const CLUSTERS = [
  [-23, 20, 148, 24, 11, .4], [-6, 24, 151, 18, 8, 1.7],
  [15, 13, 146, 24, 10, 3.2], [26, 22, 154, 19, 8, 5],
] as const;

export class CoastalClouds {
  readonly texture = coastalCloudTexture();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({ map: this.texture,
    transparent: true, depthWrite: false, fog: false, toneMapped: false });
  readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, COUNT);
  private readonly transform = new THREE.Object3D();
  constructor() {
    this.geometry.setAttribute('cloudTile', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float cloudTile;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=(vMapUv.x+cloudTile)*.25;\n#endif');
    };
    this.material.customProgramCacheKey = () => 'coastal-cloud-atlas-v1';
    this.mesh.name = 'coastal-distant-clouds'; this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.update(0);
  }
  update(nowMs: number): void {
    const seconds = nowMs / 1000;
    CLUSTERS.forEach(([x, y, z, width, height, phase], index) => {
      // Absolute presentation time keeps Retry/rewind deterministic; drift is under .1 unit/sec.
      this.transform.position.set(x + 3 * Math.sin(seconds * .026 + phase),
        y + .12 * Math.sin(seconds * .018 + phase), z);
      this.transform.rotation.set(0, Math.PI, 0);
      this.transform.scale.set(width, height, 1); this.transform.updateMatrix();
      this.mesh.setMatrixAt(index, this.transform.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.mesh.dispose(); this.geometry.dispose(); this.material.dispose(); this.texture.dispose(); }
}
