import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { foliageMassTexture, flowerSpeckTexture } from '../art/FoliageTexture';

const C = ART.coastalDefense;
const TREES = [
  { side: -1, x: 3.2, z: 19, h: 4.3, size: 1.35 },
  { side: 1, x: 3.8, z: 30, h: 5.3, size: 1.65 },
  { side: -1, x: 5.1, z: 39, h: 5.7, size: 1.9 },
  { side: 1, x: 13, z: 53, h: 6.1, size: 2.0 },
] as const;

export class CoastalVegetation {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly foliageTexture = foliageMassTexture();
  private readonly crown = new THREE.PlaneGeometry(2, 2, 4, 2);
  private readonly flowerTexture = flowerSpeckTexture();
  private readonly flower = new THREE.PlaneGeometry(2, 2, 2, 2);
  private readonly trunk = new THREE.CylinderGeometry(.12, .22, 1, 5);
  private readonly patch = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
  private readonly foliage = new THREE.MeshBasicMaterial({
    map: this.foliageTexture, alphaTest: .4, side: THREE.DoubleSide,
    toneMapped: false,
  });
  private readonly flowers = new THREE.MeshBasicMaterial({ map: this.flowerTexture,
    alphaTest: .4, side: THREE.DoubleSide, toneMapped: false });
  private readonly bark = illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.bark, flatShading: true }));
  private readonly shadow = new THREE.MeshBasicMaterial({ color: C.shadow, transparent: true, opacity: .24, depthWrite: false });
  private readonly time = { value: 0 };
  private readonly meshes: THREE.InstancedMesh[] = [];
  constructor() {
    this.group.name = 'coastal-olive-and-vines'; this.group.add(...this.sides);
    for (const material of [this.foliage, this.flowers]) {
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer); shader.uniforms.coastalWind = this.time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float coastalWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].z*.31 + instanceMatrix[3].y*.73;
            transformed.x += sin(coastalWind*.42 + phase)*.022*(position.y+1.);
            transformed.z += cos(coastalWind*.35 + phase)*.012*(position.y+1.);
            #endif`);
      };
      material.customProgramCacheKey = () => 'coastal-layered-foliage-v2';
    }
    const transform = new THREE.Object3D();
    for (const side of [-1, 1]) {
      const root = this.sides[side < 0 ? 0 : 1], trees = TREES.filter(tree => tree.side === side);
      const families = [
        { geometry: this.crown, material: this.foliage, count: trees.length * 4 + 5, name: 'coastal-leafy-masses' },
        { geometry: this.flower, material: this.flowers, count: 4, name: 'side-flower-masses' },
        { geometry: this.trunk, material: this.bark, count: trees.length * 3, name: 'olive-trunks-and-branches' },
        { geometry: this.patch, material: this.shadow, count: trees.length, name: 'olive-ground-shadows' },
      ];
      families.forEach(({ geometry, material, count, name }, family) => {
        const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = name;
        for (let i = 0; i < count; i++) {
          const angle = i * 2.399963;
          transform.rotation.set(0, 0, 0);
          if (family === 0) {
            if (i < trees.length * 4) {
              const tree = trees[Math.floor(i / 4)], layer = i % 4;
              // Crossed and offset in depth, never camera-facing billboards. Four
              // irregular silhouettes make a crown with real parallax/volume.
              transform.position.set(side * tree.x + Math.sin(angle)*.20,
                tree.h + Math.cos(angle)*.18, tree.z + Math.sin(angle*1.7)*.45);
              transform.rotation.set(Math.sin(angle)*.18, [-.6, .35, 1.05, -1.0][layer], Math.cos(angle)*.12);
              transform.scale.set(tree.size * 1.40, tree.size * .70, 1);
            } else {
              transform.position.set(side * (side < 0 ? 2.4 : 1.7), 2.3 + (i % 3)*.55,
                (side < 0 ? 14.8 : 21.4) + (i % 3)*.35);
              transform.rotation.set(.12, Math.sin(angle)*.45, Math.cos(angle)*.3);
              transform.scale.set(.72, .65, 1);
            }
          } else if (family === 1) {
            transform.position.set(side * (side < 0 ? 2.35 : 1.65),
              2.45 + (i % 3)*.55, (side < 0 ? 14.4 : 21.05) + (i % 3)*.35);
            transform.rotation.set(.12, Math.sin(angle)*.2, Math.cos(angle)*.18);
            transform.scale.set(.50, .46, 1);
          } else if (family === 2) {
            const tree = trees[Math.floor(i / 3)], branch = i % 3;
            transform.position.set(side * tree.x + (branch ? (branch === 1 ? -.25 : .25) : 0),
              tree.h * (branch ? .72 : .43), tree.z + (branch ? (branch === 1 ? -.12 : .12) : 0));
            transform.rotation.set(branch ? .35 : 0, 0, branch ? (branch === 1 ? -.65 : .65) : side * -.12);
            transform.scale.set(branch ? .65 : 1, tree.h * (branch ? .36 : .86), branch ? .65 : 1);
          } else {
            const tree = trees[i];
            transform.position.set(side * tree.x + 1.1, .024, tree.z + .8);
            transform.scale.set(tree.size * 1.3, 1, tree.size * .9);
          }
          transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true; root.add(mesh); this.meshes.push(mesh);
      });
    }
  }
  update(halfWidth: number, nowMs: number): void {
    this.sides[0].position.x = -halfWidth - .8; this.sides[1].position.x = halfWidth + .8;
    this.time.value = nowMs / 1000;
  }
  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose());
    this.crown.dispose(); this.flower.dispose(); this.trunk.dispose(); this.patch.dispose();
    this.foliage.dispose(); this.flowers.dispose(); this.bark.dispose(); this.shadow.dispose(); this.foliageTexture.dispose(); this.flowerTexture.dispose();
  }
}
