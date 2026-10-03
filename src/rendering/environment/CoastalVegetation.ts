import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';

const C = ART.coastalDefense;
// Few broad olive crowns and climbing masses, never individual leaf sprites.
const TREES = [
  { side: -1, x: 3.2, z: 19, h: 4.3, size: 1.35 },
  { side: 1, x: 3.8, z: 30, h: 5.3, size: 1.65 },
  { side: -1, x: 5.1, z: 39, h: 5.7, size: 1.9 },
  { side: 1, x: 13, z: 53, h: 6.1, size: 2.0 },
] as const;

export class CoastalVegetation {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly crown = new THREE.IcosahedronGeometry(1, 1);
  private readonly trunk = new THREE.CylinderGeometry(.12, .22, 1, 5);
  private readonly patch = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
  private readonly materials = [C.foliageDark, C.foliageLight, C.flower, C.bark].map(color =>
    illustratedMaterial(new THREE.MeshStandardMaterial({ color, flatShading: true })));
  private readonly shadow = new THREE.MeshBasicMaterial({ color: C.shadow, transparent: true, opacity: .24, depthWrite: false });
  private readonly time = { value: 0 };
  private readonly meshes: THREE.InstancedMesh[] = [];
  constructor() {
    this.group.name = 'coastal-olive-and-vines'; this.group.add(...this.sides);
    this.materials.slice(0, 3).forEach(material => {
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer); shader.uniforms.coastalWind = this.time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float coastalWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
            transformed.x+=sin(coastalWind*.42+instanceMatrix[3].z*.31)*.045*(position.y+1.);
            #endif`);
      };
      material.customProgramCacheKey = () => 'coastal-foliage-masses-v1';
    });
    const transform = new THREE.Object3D();
    for (const side of [-1, 1]) {
      const root = this.sides[side < 0 ? 0 : 1], trees = TREES.filter(tree => tree.side === side);
      for (let family = 0; family < 5; family++) {
        const geometry = family < 3 ? this.crown : family === 3 ? this.trunk : this.patch;
        const material = family < 4 ? this.materials[family] : this.shadow;
        const count = family < 2 ? trees.length * 4 + 5 : family === 2 ? 4 : trees.length;
        const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.name = family === 2 ? 'side-flower-masses' : family === 3 ? 'olive-trunks' : 'coastal-leafy-masses';
        for (let i = 0; i < count; i++) {
          const tree = trees[Math.floor(i / 4) % trees.length], angle = i * 2.399963 + family * 1.35;
          transform.rotation.set(0, angle, family === 3 ? side * -.12 : 0);
          if (family < 2) {
            if (i < trees.length * 4) {
              transform.position.set(side * tree.x + Math.cos(angle) * tree.size * .55,
                tree.h + Math.sin(angle * .71) * .3, tree.z + Math.sin(angle) * tree.size * .6);
              transform.scale.set(tree.size * .92, tree.size * .52, tree.size * .78);
            } else {
              transform.position.set(side * (side < 0 ? 2.4 : 1.7) + family * .1, 2.3 + (i % 3) * .55 + family * .1,
                (side < 0 ? 14.8 + (i % 3) * .3 : 21.4 + (i % 3) * .35) + family * .2);
              transform.scale.set(.65, .52, .4);
            }
          } else if (family === 2) {
            transform.position.set(side * ((side < 0 ? 2.6 : 1.8) + (i % 2) * .25), 4.0 + Math.sin(angle) * .3, side < 0 ? 14.7 + i * .25 : 21.4 + i * .25);
            transform.scale.set(.42, .3, .37);
          } else {
            const t = trees[i];
            transform.position.set(side * t.x + (family === 4 ? 1.1 : 0), family === 3 ? t.h * .43 : .024, t.z + (family === 4 ? .8 : 0));
            transform.scale.set(family === 3 ? 1 : t.size * 1.3, family === 3 ? t.h * .86 : 1, family === 3 ? 1 : t.size * .9);
          }
          transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true; root.add(mesh); this.meshes.push(mesh);
      }
    }
  }
  update(halfWidth: number, nowMs: number): void {
    this.sides[0].position.x = -halfWidth - .8; this.sides[1].position.x = halfWidth + .8;
    this.time.value = nowMs / 1000;
  }
  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose()); this.crown.dispose(); this.trunk.dispose(); this.patch.dispose();
    this.materials.forEach(material => material.dispose()); this.shadow.dispose();
  }
}
