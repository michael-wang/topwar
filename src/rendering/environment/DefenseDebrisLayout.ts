export interface DebrisPiece {
  x: number; y: number; z: number; width: number; height: number; depth: number;
  pitch: number; tilt: number; yaw: number; color: 'concrete' | 'steel' | 'rust';
}

// Authored, asymmetric piles and gaps. Samples only vary disposable scenery;
// they never consume the gameplay RNG or change collision/lane membership.
const CLUSTERS = {
  left: [[.1, 5.1, 5], [1.05, 14.2, 4], [.45, 27.5, 6], [1.5, 38.6, 3]],
  right: [[1.15, 8.8, 3], [.05, 21.3, 6], [1.3, 32.6, 4], [.6, 43.1, 5]],
} as const;
const SHAPES = [
  [1.6, .4, 2.4, 'concrete'], [1.2, .85, .45, 'concrete'], [.9, .8, 1.3, 'steel'],
  [1.25, .16, .7, 'rust'], [.14, 1.9, .16, 'steel'], [.14, 1.55, .16, 'steel'],
] as const;
function sample(seed: number): number {
  let bits = Math.imul(seed ^ 0x9e3779b9, 0x7feb352d);
  bits = Math.imul(bits ^ (bits >>> 15), 0x846ca68b);
  return ((bits ^ (bits >>> 16)) >>> 0) / 0x100000000;
}

export function defenseSideDebris(side: -1 | 1): DebrisPiece[] {
  const result: DebrisPiece[] = [];
  const clusters = side < 0 ? CLUSTERS.left : CLUSTERS.right;
  clusters.forEach(([x, z, count], cluster) => {
    for (let member = 0; member < count; member++) {
      const seed = (side < 0 ? 131 : 719) + cluster * 37 + member * 11;
      const [width, height, depth, color] = SHAPES[(member + cluster * 2 + (side > 0 ? 3 : 0)) % SHAPES.length];
      const size = .75 + sample(seed) * .45;
      result.push({ x: x + .1 + sample(seed + 1) * 1.15, z: z + (sample(seed + 2) - .5) * 3.1,
        y: height * size * .46, width: width * size, height: height * size, depth: depth * size,
        pitch: (sample(seed + 3) - .5) * .35, tilt: (sample(seed + 4) - .5) * 1.5,
        yaw: (sample(seed + 5) - .5) * Math.PI * 1.5, color });
    }
  });
  return result;
}
