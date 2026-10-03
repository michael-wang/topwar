import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';

const C = ART.coastalDefense;
// Fixed top edge, soft sag/breeze and a chipped corner. No cloth physics or CPU vertex churn.
export function coastalCanvasGeometry(width: number, depth: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth, 8, 3).rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i), free = (z + depth / 2) / depth;
    position.setY(i, -.36 * free * free);
    if (position.getX(i) > width * .37 && free > .7) position.setX(i, position.getX(i) - .32 * free);
  }
  position.needsUpdate = true; geometry.computeVertexNormals(); return geometry;
}

export class CoastalCloth {
  readonly group = new THREE.Group();
  private readonly canvases: THREE.Mesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly times: { value: number }[] = [];
  constructor() {
    this.group.name = 'coastal-shade-canvas';
    for (const [i, side, x, z, y, width, depth] of [[0, -1, 2.5, 21.8, 2.65, 2.5, 1.8], [1, 1, 2.3, 24.5, 3.45, 2.6, 2.0]]) {
      const geometry = coastalCanvasGeometry(width, depth); this.geometries.push(geometry);
      const material = illustratedMaterial(new THREE.MeshStandardMaterial({ color: i ? C.clothIvory : C.cloth, side: THREE.DoubleSide }));
      this.materials.push(material); const time = { value: 0 }; this.times.push(time);
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer); shader.uniforms.canvasTime = time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float canvasTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float freeEdge=clamp((position.z+${(depth / 2).toFixed(3)})/${depth.toFixed(3)},0.,1.);
            transformed.y+=(sin(canvasTime*.65+position.x*1.5+${(i * 2.3).toFixed(2)})*.12
              +sin(canvasTime*.31+position.x*3.1+${i.toFixed(2)})*.035)*freeEdge;`);
      };
      material.customProgramCacheKey = () => `coastal-canvas-${i}-v1`;
      const canvas = new THREE.Mesh(geometry, material); canvas.name = 'wind-coastal-canvas';
      canvas.position.set(side * x, y, z); canvas.userData.side = side; canvas.userData.outward = x;
      canvas.rotation.set(-.65, side * .07, 0); this.canvases.push(canvas); this.group.add(canvas);
      const shadowGeometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2); this.geometries.push(shadowGeometry);
      const shadowMaterial = new THREE.MeshBasicMaterial({ color: C.shadow, transparent: true, opacity: .20, depthWrite: false }); this.materials.push(shadowMaterial);
      const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial); shadow.name = 'canvas-graphic-shadow';
      shadow.position.set(side * x + .7, .021, z + .8); shadow.rotation.y = side * .07; this.group.add(shadow);
      shadow.userData.side = side; shadow.userData.outward = x + side * .7;
      this.canvases.push(shadow);
    }
  }
  update(halfWidth: number, nowMs: number): void {
    for (const mesh of this.canvases) mesh.position.x = mesh.userData.side * (halfWidth + .8 + mesh.userData.outward);
    this.times.forEach(time => { time.value = nowMs / 1000; });
  }
  dispose(): void { this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); }
}
