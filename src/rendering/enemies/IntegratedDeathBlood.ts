import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMY_DEATH_TIMING, enemyDeathPose, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
import { deathVariant } from './DeathAssembly';

export const DEATH_BLOOD_CAPACITY = 64;
export const DEATH_BLOOD_COLORS = ['#751d27', '#9f2734', '#c93443', '#d94a50'] as const;
export const BLOOD_PIECE_COUNTS = { grunt: 4, heavy: 5, giant: 7 } as const;
export const BLOOD_EXPANSION = { grunt: .10, heavy: .14, giant: .22 } as const;
const ORIGINS = {
  grunt: [[0,.34,0],[.03,.43,-.02],[-.10,.31,.015],[.11,.30,.02]],
  heavy: [[0,.35,0],[-.05,.45,.02],[-.14,.32,.03],[.14,.36,.02],[0,.55,.025]],
  giant: [[0,.40,.03],[.03,.65,0],[-.16,.52,.04],[.16,.56,.03],[-.07,.78,.02],[.10,.37,.015],[0,.95,.02]],
} as const;

export function bloodPieceOrigin(role: EnemyDeathRole, variant: number, piece: number): readonly [number, number, number] {
  const [x,y,z] = ORIGINS[role][piece];
  if (variant === 0) return [x,y,z];
  if (variant === 1) return [x*.65 + .025*Math.sin(piece*2), y + .035*Math.cos(piece*2.4), z-.02];
  return [x+.035*Math.cos(piece+1), y+.025*Math.sin(piece*2+1), z+.025*Math.sin(piece+2)];
}
export function bloodPieceKick(variant: number, piece: number): readonly [number, number, number] {
  const side = piece % 2 ? -1 : 1;
  return variant === 0 ? [side*.85,.15,(piece%3-1)*.25]
    : variant === 1 ? [side*.3,(piece%3-1)*.7,.2]
    : [side*.60,.25,(piece%3-1)*.45];
}

export function integratedBloodGeometry(role: EnemyDeathRole): THREE.BufferGeometry {
  const parts = Array.from({length:BLOOD_PIECE_COUNTS[role]}, (_,piece) => {
    const source = piece%3===1 ? new THREE.ConeGeometry(.065,.17,6,1)
      : piece%3===2 ? new THREE.SphereGeometry(.085,6,3).scale(1.15,.65,.75)
      : new THREE.SphereGeometry(.085,8,4).scale(1.15,.85,1);
    const geometry = source.toNonIndexed(); source.dispose(); geometry.deleteAttribute('uv');
    const p = geometry.getAttribute('position'), c = new THREE.Color(DEATH_BLOOD_COLORS[piece%4]);
    const colors = new Float32Array(p.count*3), ids = new Float32Array(p.count).fill(piece);
    for(let i=0;i<p.count;i++) {
      // Coherent low-poly irregular mass, not a perfect bead or a flat plane.
      const wobble=1+.10*Math.sin(p.getX(i)*31+p.getY(i)*27+piece);
      p.setXYZ(i,p.getX(i)*wobble,p.getY(i)*wobble,p.getZ(i)*wobble); c.toArray(colors,i*3);
    }
    geometry.computeVertexNormals(); geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('bloodPieceId',new THREE.BufferAttribute(ids,1));
    const origins=new Float32Array(p.count*3),origin=ORIGINS[role][piece];
    for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)origins[i*3+axis]=origin[axis];
    geometry.setAttribute('bloodOrigin',new THREE.BufferAttribute(origins,3));
    return geometry;
  });
  const geometry=mergeGeometries(parts); parts.forEach(g=>g.dispose());
  if(!geometry)throw new Error('Blood pieces must share a static role batch');
  return geometry;
}

interface BloodSlot { id:number; role:EnemyDeathRole; startedAt:number; matrix:THREE.Matrix4; variant:number }
interface BloodBatch { mesh:THREE.InstancedMesh; progress:THREE.InstancedBufferAttribute; opacity:THREE.InstancedBufferAttribute; expansion:THREE.InstancedBufferAttribute; variant:THREE.InstancedBufferAttribute; count:number }

// One merged blood geometry/draw per active role. All slots/matrices are allocated
// at renderer construction, never a mesh, timer or hierarchy per blood piece.
export class IntegratedDeathBlood {
  private readonly slots:BloodSlot[]=Array.from({length:DEATH_BLOOD_CAPACITY},()=>({id:-1,role:'grunt',startedAt:-Infinity,matrix:new THREE.Matrix4(),variant:0}));
  private readonly batches=new Map<EnemyDeathRole,BloodBatch>();
  private cursor=0;
  constructor(private readonly scene:THREE.Scene) {
    for(const role of ['grunt','heavy','giant'] as const) {
      const geometry=integratedBloodGeometry(role),attribute=()=>new THREE.InstancedBufferAttribute(new Float32Array(DEATH_BLOOD_CAPACITY),1);
      const progress=attribute(),opacity=attribute(),expansion=attribute(),variant=attribute();
      geometry.setAttribute('bloodProgress',progress);geometry.setAttribute('bloodOpacity',opacity);geometry.setAttribute('bloodExpansion',expansion);geometry.setAttribute('bloodVariant',variant);
      const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,transparent:true,depthWrite:false});
      material.onBeforeCompile=shader=>{
        shader.vertexShader=`attribute float bloodProgress; attribute float bloodOpacity; attribute float bloodExpansion; attribute float bloodVariant;
attribute vec3 bloodOrigin; attribute float bloodPieceId;
varying float vBloodOpacity;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 origin = bloodOrigin;
float side = mod(bloodPieceId,2.) < .5 ? 1. : -1.;
vec3 kick = vec3(side*.85,.15,(mod(bloodPieceId,3.)-1.)*.25);
if (bloodVariant > .5 && bloodVariant < 1.5) {
  origin = vec3(origin.x*.65+.025*sin(bloodPieceId*2.),origin.y+.035*cos(bloodPieceId*2.4),origin.z-.02);
  kick = vec3(side*.3,(mod(bloodPieceId,3.)-1.)*.7,.2);
} else if (bloodVariant > 1.5) {
  origin += vec3(.035*cos(bloodPieceId+1.),.025*sin(bloodPieceId*2.+1.),.025*sin(bloodPieceId+2.));
  kick = vec3(side*.60,.25,(mod(bloodPieceId,3.)-1.)*.45);
}
transformed += origin + kick * bloodExpansion * bloodProgress;
vBloodOpacity = bloodOpacity;`);
        shader.fragmentShader=`varying float vBloodOpacity;\n${shader.fragmentShader}`.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vBloodOpacity;');
      };
      material.customProgramCacheKey=()=> 'integrated-matte-blood-v2';
      const mesh=new THREE.InstancedMesh(geometry,material,DEATH_BLOOD_CAPACITY);
      mesh.name=`enemy-3d-blood-${role}`;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
      this.batches.set(role,{mesh,progress,opacity,expansion,variant,count:0});
    }
  }
  spawn(id:number,role:EnemyDeathRole,nowMs:number,bodyWorld:THREE.Matrix4):void {
    let index=this.cursor;
    for(let n=0;n<DEATH_BLOOD_CAPACITY;n++){const candidate=(this.cursor+n)%DEATH_BLOOD_CAPACITY,slot=this.slots[candidate];if(nowMs>=slot.startedAt+ENEMY_DEATH_TIMING[slot.role].totalMs){index=candidate;break;}}
    const slot=this.slots[index];slot.id=id;slot.role=role;slot.startedAt=nowMs;slot.matrix.copy(bodyWorld);slot.variant=deathVariant(id);this.cursor=(index+1)%DEATH_BLOOD_CAPACITY;
  }
  update(nowMs:number):void {
    for(const batch of this.batches.values())batch.count=0;
    for(const slot of this.slots) {
      const age=nowMs-slot.startedAt,timing=ENEMY_DEATH_TIMING[slot.role],pose=enemyDeathPose(age,timing);
      if(age<timing.breakupStartMs||!pose.bodyVisible)continue;
      const batch=this.batches.get(slot.role)!,index=batch.count++,m=slot.matrix.elements;
      const scale=Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
      batch.mesh.setMatrixAt(index,slot.matrix);batch.variant.setX(index,slot.variant);
      batch.progress.setX(index,Math.min(1,(age-timing.breakupStartMs)/(timing.totalMs*.20)));
      batch.expansion.setX(index,BLOOD_EXPANSION[slot.role]/Math.max(.001,scale));batch.opacity.setX(index,pose.bodyOpacity);
    }
    for(const batch of this.batches.values()){batch.mesh.count=batch.count;batch.mesh.visible=batch.count>0;batch.mesh.instanceMatrix.needsUpdate=true;batch.progress.needsUpdate=batch.opacity.needsUpdate=batch.expansion.needsUpdate=batch.variant.needsUpdate=true;}
  }
  reset():void {this.slots.forEach(slot=>slot.startedAt=-Infinity);this.cursor=0;for(const b of this.batches.values()){b.mesh.count=0;b.mesh.visible=false;}}
  dispose():void {for(const {mesh}of this.batches.values()){this.scene.remove(mesh);mesh.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
