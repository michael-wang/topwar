import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

const C = ART.coastalDefense;
// Authored asymmetric civilian village. X is measured outward from the track edge.
export const COASTAL_BUILDINGS = [
  { side: -1, offset: 2.6, z: 24, width: 3.7, height: 3.2, depth: 4.5, angle: .07 },
  { side: 1, offset: 3.1, z: 35, width: 4.5, height: 3.8, depth: 5.5, angle: -.09 },
  { side: -1, offset: 3.5, z: 43, width: 3.9, height: 2.9, depth: 4.6, angle: -.06 },
  { side: 1, offset: 8, z: 58, width: 6, height: 3.3, depth: 6, angle: .04 },
] as const;

export class CoastalArchitecture {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly block = paintedBlockGeometry();
  private readonly plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).toNonIndexed();
  private readonly materials = {
    plaster: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plaster })),
    shade: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plasterShade })),
    // A cool plaster side plane, not a wall-sized navy interior.
    wallShadow: new THREE.MeshBasicMaterial({ color: new THREE.Color(C.plasterShade)
      .lerp(new THREE.Color(C.secondaryShadow), .22), toneMapped: false }),
    door: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.cloth })),
    dark: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.secondaryShadow })),
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
      this.part(building, 'window-plaster-surround', w * .23, h * .58, -d / 2 - .04, .82, .95, .08, 'shade');
      this.part(building, 'window-recess', w * .23, h * .58, -d / 2 - .10, .60, .73, .05, 'dark');
      this.part(building, 'shutter-half', w * .28, h * .58, -d / 2 - .15, .28, .75, .08, 'door');
      // Plaster jambs and painted leaf dominate; shadow occupies only the inner opening.
      for (const x of [-.51, .51]) this.part(building, 'plaster-door-jamb', x, .78, -d / 2 - .08,
        .14, 1.56, .18, 'plaster');
      this.part(building, 'plaster-door-lintel', 0, 1.53, -d / 2 - .08, 1.14, .16, .18, 'plaster');
      this.part(building, 'sun-bleached-door', 0, .72, -d / 2 - .07, .88, 1.42, .10, 'door');
      this.part(building, 'door-inner-recess', .19, .68, -d / 2 - .14, .42, 1.16, .05, 'dark');
      this.part(building, 'plaster-door-step', 0, .12, -d / 2 - .4, 1.3, .24, .65, 'plaster');
      this.shadow(side, layout.side * layout.offset + 1.2, layout.z + 1.5, w + 2, d + 1, layout.angle - .18);
    }
    // Civilian terrace and arch frame the street; neither crosses the combat field.
    this.arch(this.sides[1], 1.7, 25);
    this.part(this.sides[0], 'plaster-terrace-wall', -2.7, .5, 20, 2.3, 1, .42, 'plaster');
    for (let step = 0; step < 4; step++) {
      this.part(this.sides[0], 'village-stair', -3.8, .16 + step * .2, 19 + step * .65, 1.6, .32 + step * .4, .7, 'plaster');
      this.part(this.sides[1], 'short-terrace-stair', 4.2, .16 + step * .2, 28 + step * .65, 2.1, .32 + step * .4, .7, 'plaster');
    }
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
}
