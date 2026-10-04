import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';

export const COASTAL_FOREGROUND_CLEARANCE = .4;
const C = ART.coastalDefense;

// Village corners continue toward the defenders; only side anchors move with
// track width. No collision, standalone pottery or central-lane dressing.
export class CoastalForeground {
  readonly group = new THREE.Group();
  private readonly sides = [new THREE.Group(), new THREE.Group()];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials = {
    plaster: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plaster })),
    shade: illustratedMaterial(new THREE.MeshStandardMaterial({ color: C.plasterShade })),
    paint: illustratedMaterial(new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true })),
  };
  constructor() {
    this.group.name = 'coastal-foreground-village';
    this.sides.forEach((side,i)=>{side.name=i?'foreground-screen-left':'foreground-screen-right';this.group.add(side);});
    const block=paintedBlockGeometry();
    const pieces = this.sides.map(()=>new Map<THREE.Material,THREE.BufferGeometry[]>());
    const part=(side:0|1,x:number,y:number,z:number,w:number,h:number,d:number,
      material:keyof CoastalForeground['materials']='plaster',tint?:string,source=block)=>{
      const baked=source.index?source.toNonIndexed():source.clone();
      baked.deleteAttribute('uv');baked.scale(w,h,d).translate(side===1?x-.3:x,y,side===0?z-1.5:z);
      if(material==='paint'){
        const color=new THREE.Color(tint),p=baked.getAttribute('position'),colors=new Float32Array(p.count*3);
        for(let i=0;i<p.count;i++)color.toArray(colors,i*3);
        baked.setAttribute('color',new THREE.BufferAttribute(colors,3));
      }
      const resource=this.materials[material];
      const list=pieces[side].get(resource)??[];list.push(baked);pieces[side].set(resource,list);
    };
    // Screen-left: cropped house corner, inner stair and low terrace at Z 6–11.
    part(1,1.65,.85,7.2,2.8,1.7,2.25);
    part(1,1.65,1.73,7.2,2.94,.12,2.38,'shade');
    part(1,1.65,1.88,8.26,2.94,.28,.24);
    part(1,2.97,1.88,7.2,.24,.28,2.25);
    part(1,.64,.96,6.04,.77,.87,.09,'shade');
    part(1,.64,.96,5.98,.59,.69,.07,'paint',C.cloth);
    part(1,.84,.96,5.93,.13,.64,.04,'paint',C.secondaryShadow);
    for(let step=0;step<4;step++)part(1,.62,.12+step*.12,5.8+step*.38,.68,.24+step*.24,.40);
    part(1,1.20,.18,10.4,1.80,.36,.42);
    // Screen-right: smaller facade, one arched cyan doorway and short steps.
    part(0,-1.65,.78,13.35,2.8,1.56,2.05);
    part(0,-1.65,1.59,13.35,2.94,.12,2.18,'shade');
    part(0,-1.65,1.75,14.30,2.94,.28,.24);
    part(0,-2.97,1.75,13.35,.24,.28,2.05);
    part(0,-1.10,.56,12.29,.76,1.10,.07,'paint',C.cloth);
    part(0,-1.04,.54,12.23,.34,.92,.035,'paint',C.secondaryShadow);
    for(const x of [-1.62,-.58])part(0,x,.55,12.20,.18,1.10,.17);
    const shape=new THREE.Shape();shape.moveTo(-.61,0);shape.lineTo(-.61,.49);
    shape.lineTo(.61,.49);shape.lineTo(.61,0);shape.lineTo(.43,0);
    shape.absarc(0,0,.43,0,Math.PI,false);shape.closePath();
    const arch=new THREE.ExtrudeGeometry(shape,{depth:.17,bevelEnabled:false,curveSegments:8});
    part(0,-1.10,1.10,12.11,1,1,1,'plaster',undefined,arch);arch.dispose();
    for(let step=0;step<2;step++)part(0,-1.10,.08+step*.08,11.55+step*.42,1.18,.16+step*.16,.45);
    part(0,-.58,.18,14.8,.36,.36,1.35);
    // Three material batches per side: stairs/parapets/door frames add no draws.
    pieces.forEach((batches,side)=>batches.forEach((sources,material)=>{
      const geometry=mergeGeometries(sources);sources.forEach(source=>source.dispose());
      if(!geometry)throw new Error('Foreground village parts must merge');
      this.geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);
      mesh.name='foreground-village-'+Object.entries(this.materials).find(([,value])=>value===material)![0];
      this.sides[side].add(mesh);
    }));
    block.dispose();
  }
  update(trackHalfWidth:number):void {
    this.sides[0].position.x=-trackHalfWidth-.8;
    this.sides[1].position.x=trackHalfWidth+.8;
  }
  dispose():void {
    this.geometries.forEach(geometry=>geometry.dispose());
    Object.values(this.materials).forEach(material=>material.dispose());
  }
}
