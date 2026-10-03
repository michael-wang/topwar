import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

const C = ART.coastalDefense;
// Authored asymmetric side compound. X is measured outward from the track edge.
export const COASTAL_BUILDINGS = [
  { side: -1, offset: 3.3, z: 18, width: 4.3, height: 3.4, depth: 5.4, angle: .07 },
  { side: 1, offset: 4.2, z: 30, width: 5.6, height: 4.3, depth: 6.2, angle: -.09 },
  { side: -1, offset: 10, z: 48, width: 8.5, height: 5.8, depth: 8, angle: -.06 },
  { side: 1, offset: 14, z: 56, width: 10, height: 4.7, depth: 7.2, angle: .04 },
] as const;

export class CoastalArchitecture {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly block = paintedBlockGeometry();
  private readonly plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).toNonIndexed();
  private readonly materials = {
    plaster: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plaster })),
    shade: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plasterShade })),
    wallShadow: new THREE.MeshBasicMaterial({ color: C.shadow, toneMapped: false }),
    door: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.cloth })),
    steel: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.charcoal })),
    rust: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.rust })),
    dark: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.shadow })),
    scorch: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.scorch })),
    shadow: new THREE.MeshBasicMaterial({ color: C.shadow, transparent: true, opacity: .36, depthWrite: false }),
  };
  private readonly baked: THREE.BufferGeometry[] = [];
  constructor() {
    this.group.name = 'coastal-defensive-compound';
    this.sides.forEach((side, i) => { side.name = i ? 'coastal-compound-right' : 'coastal-compound-left'; this.group.add(side); });
    for (const layout of COASTAL_BUILDINGS) {
      const side = this.sides[layout.side < 0 ? 0 : 1], building = new THREE.Group();
      building.position.set(layout.side * layout.offset, 0, layout.z); building.rotation.y = layout.angle;
      side.add(building);
      const { width: w, height: h, depth: d } = layout;
      this.part(building, 'whitewashed-building', 0, h / 2, 0, w, h, d, 'plaster');
      if (layout.side < 0) this.part(building, 'cool-shadow-wall-face', w / 2 + .015, h * .48, 0,
        .03, h * .92, d * .93, 'wallShadow');
      // Low flat roof and separate broad cornice planes make a diorama silhouette.
      this.part(building, 'roof-parapet', 0, h + .16, d / 2, w + .16, .36, .35, 'plaster');
      this.part(building, 'roof-parapet', -w / 2, h + .16, 0, .35, .36, d, 'plaster');
      this.part(building, 'roof-cap', 0, h + .02, 0, w + .25, .12, d + .2, 'shade');
      this.part(building, 'cyan-shutter', -w * .20, h * .56, -d / 2 - .02, .92, 1.12, .12, 'door');
      this.part(building, 'window-recess', w * .23, h * .58, -d / 2 - .03, .8, .95, .10, 'dark');
      this.part(building, 'shutter-half', w * .27, h * .58, -d / 2 - .10, .38, .95, .10, 'door');
      this.part(building, 'sun-bleached-door', 0, .72, -d / 2 - .06, .92, 1.44, .12, 'dark');
      // Small bounded scorch patch/damaged edge, never high-frequency grunge.
      this.part(building, 'broken-concrete-edge', w * .38, .32, -d / 2 - .16, .7, .5, .8, 'shade', -.24);
      this.shadow(side, layout.side * layout.offset + 1.2, layout.z + 1.5, w + 2, d + 1, layout.angle - .18);
    }
    // A broken low wall and an open arch frame separate corners; no cross-field wall.
    this.arch(this.sides[1], 1.7, 22);
    this.part(this.sides[0], 'broken-white-wall', -1.8, .65, 8, 2.5, 1.3, .48, 'plaster', -.04);
    this.part(this.sides[0], 'fallen-white-parapet', -2.2, .22, 10.4, 2.4, .4, 1, 'shade', -.28);
    for (let step = 0; step < 4; step++)
      this.part(this.sides[1], 'short-terrace-stair', 4.2, .16 + step * .2, 24 + step * .65, 2.4, .32 + step * .4, .7, 'plaster');
    // Two recognizable wrecks instead of many unrelated gray scraps.
    this.wreck(this.sides[0], -1.7, 34, -.35);
    this.wreck(this.sides[1], 2.1, 44, .27);
    // Static geometry is merged per material and side once, preserving side-edge adaptation.
    for (const side of this.sides) for (const [name, material] of Object.entries(this.materials)) {
      const pieces: THREE.BufferGeometry[] = [];
      side.updateMatrixWorld(true);
      side.traverse(child => {
        if (!(child instanceof THREE.Mesh) || child.material !== material) return;
        const matrix = new THREE.Matrix4().copy(side.matrixWorld).invert().multiply(child.matrixWorld);
        pieces.push(child.geometry.clone().applyMatrix4(matrix));
      });
      if (!pieces.length) continue;
      const geometry = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose()); this.baked.push(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `coastal-${name}-forms`;
      // Source meshes are removed after all materials have been collected below.
      mesh.userData.baked = true; side.add(mesh);
    }
    for (const side of this.sides) for (const child of [...side.children]) if (!child.userData.baked) side.remove(child);
  }
  update(halfWidth: number): void { this.sides[0].position.x = -halfWidth - .8; this.sides[1].position.x = halfWidth + .8; }
  dispose(): void {
    this.block.dispose(); this.plane.dispose(); this.baked.forEach(geometry => geometry.dispose());
    Object.values(this.materials).forEach(material => material.dispose());
  }
  private part(parent: THREE.Group, name: string, x: number, y: number, z: number,
    w: number, h: number, d: number, material: keyof CoastalArchitecture['materials'], tilt = 0): void {
    const mesh = new THREE.Mesh(this.block, this.materials[material]); mesh.name = name;
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.z = tilt; parent.add(mesh);
  }
  private shadow(parent: THREE.Group, x: number, z: number, w: number, d: number, angle: number): void {
    const mesh = new THREE.Mesh(this.plane, this.materials.shadow); mesh.name = 'graphic-coastal-shadow';
    mesh.position.set(x, .018, z); mesh.scale.set(w, 1, d); mesh.rotation.y = angle; parent.add(mesh);
  }
  private arch(parent: THREE.Group, x: number, z: number): void {
    // Three broad pieces suggest an opening; curved underside is a single low-segment extrusion.
    for (const offset of [-1.2, 1.2]) this.part(parent, 'arch-pier', x + offset, 1.15, z, .62, 2.3, .7, 'plaster');
    const shape = new THREE.Shape(); shape.moveTo(-1.52, 2); shape.lineTo(-1.52, 3.7);
    shape.lineTo(1.52, 3.7); shape.lineTo(1.52, 2); shape.lineTo(.89, 2);
    shape.absarc(0, 2, .89, 0, Math.PI, false); shape.lineTo(-1.52, 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .65, bevelEnabled: false, curveSegments: 8 });
    const mesh = new THREE.Mesh(geometry, this.materials.plaster); mesh.position.set(x, 0, z - .32); parent.add(mesh);
    this.baked.push(geometry); this.shadow(parent, x + 1.2, z + 1.2, 3.4, 2.4, -.25);
  }
  private wreck(parent: THREE.Group, x: number, z: number, angle: number): void {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; parent.add(g);
    this.part(g, 'wrecked-coastal-machinery', 0, .55, 0, 2.4, .9, 3.5, 'steel');
    this.part(g, 'crushed-machine-cab', -.35, 1.1, .4, 1.7, 1.2, 1.6, 'rust', .22);
    this.part(g, 'broken-equipment-arm', 1.1, .6, -1, .35, 1.8, .38, 'steel', -.62);
    this.shadow(parent, x + .6, z + .6, 3.3, 4.2, angle);
  }
}
