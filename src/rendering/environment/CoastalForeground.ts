import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

export const COASTAL_FOREGROUND_CLEARANCE = .4;
const SIDE_OFFSET = .8;
const C = ART.coastalDefense;

// Two low civilian clusters, authored outward from the configured track edge.
// Screen-left is positive X under the gameplay camera; neither side has collision.
export class CoastalForeground {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials = {
    plaster: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plaster })),
    wood: illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#c8ae83' })),
    ceramic: illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#b58b70' })),
    rope: illustratedMaterial(new THREE.MeshStandardMaterial({ color: '#a99c7e' })),
    canvas: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.cloth })),
  };
  constructor() {
    this.group.name = 'coastal-foreground-life';
    this.sides.forEach((side,i)=>{side.name=i?'foreground-screen-left':'foreground-screen-right';this.group.add(side);});
    const block=paintedBlockGeometry();
    const pot=new THREE.LatheGeometry([[.12,0],[.22,.06],[.30,.20],[.27,.44],[.14,.59],[.14,.70]]
      .map(([x,y])=>new THREE.Vector2(x,y)),10);
    const rim=new THREE.TorusGeometry(.145,.035,4,10).rotateX(Math.PI/2);
    const coil=new THREE.TorusGeometry(.23,.045,4,12).rotateX(Math.PI/2);
    const pieces = this.sides.map(()=>new Map<THREE.Material,THREE.BufferGeometry[]>());
    const part=(side:0|1,geometry:THREE.BufferGeometry,material:keyof CoastalForeground['materials'],
      x:number,y:number,z:number,w=1,h=1,d=1,angle=0)=>{
      const baked=geometry.index?geometry.toNonIndexed():geometry.clone();
      for(const key of Object.keys(baked.attributes))if(key!=='position'&&key!=='normal')baked.deleteAttribute(key);
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),new THREE.Vector3(w,h,d));
      baked.applyMatrix4(matrix);const resource=this.materials[material];
      const list=pieces[side].get(resource)??[];list.push(baked);pieces[side].set(resource,list);
    };
    const vessel=(side:0|1,x:number,z:number,size:number)=>{
      part(side,pot,'ceramic',x,.025,z,size,size,size);
      part(side,rim,'ceramic',x,.025+.70*size,z,size,size,size);
    };
    // Screen-left: whitewashed low bench, two vessels, one quiet fishing-rope coil.
    part(1,block,'plaster',1.05,.18,7.5,2.1,.36,.48,.04);
    vessel(1,.32,8.55,.9);vessel(1,.95,10.3,.75);
    part(1,coil,'rope',.18,.065,9.65);
    part(1,coil,'rope',.18,.07,9.65,.65,1,.65);
    // Screen-right: short terrace step, pale timber seat, folded cyan cloth, vessel.
    part(0,block,'plaster',-1.15,.12,12.7,2.25,.24,.75,-.035);
    part(0,block,'wood',-.95,.39,13.05,1.05,.14,.48,-.05);
    for(const x of [-1.32,-.58])part(0,block,'wood',x,.25,13.05,.15,.28,.36);
    part(0,block,'canvas',-.75,.49,12.98,.62,.06,.40,.08);
    vessel(0,-1.8,14.05,.85);
    // One merged draw per material/side; seven draws total, regardless of prop count.
    pieces.forEach((batches,side)=>batches.forEach((sources,material)=>{
      const geometry=mergeGeometries(sources)!;sources.forEach(source=>source.dispose());
      this.geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);
      mesh.name='foreground-'+Object.entries(this.materials).find(([,value])=>value===material)![0];
      this.sides[side].add(mesh);
    }));
    block.dispose();pot.dispose();rim.dispose();coil.dispose();
  }
  update(trackHalfWidth:number):void {
    this.sides[0].position.x=-trackHalfWidth-SIDE_OFFSET;
    this.sides[1].position.x=trackHalfWidth+SIDE_OFFSET;
  }
  dispose():void {
    this.geometries.forEach(geometry=>geometry.dispose());
    Object.values(this.materials).forEach(material=>material.dispose());
  }
}
