import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMY_DEATH_TIMING, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
import { deathVariant } from './DeathAssembly';
import type { GroundBloodStains } from './BloodSplat';

export const DEATH_BLOOD_CAPACITY = 64;
export const DEATH_BLOOD_COLORS = ['#751d27', '#9f2734', '#c93443', '#d94a50'] as const;
export const BLOOD_PIECE_COUNTS = { grunt: 4, heavy: 5, giant: 7 } as const;
export const BLOOD_EXPANSION = { grunt: .10, heavy: .14, giant: .22 } as const;
export const BLOOD_RELEASE_FRACTION = .54;
export const BLOOD_CONTACT_FADE_MS = 65;
const GRAVITY = { grunt: 18, heavy: 6, giant: 2.8 } as const;
const HALF_EXTENTS = [[.108,.080,.094],[.072,.094,.072],[.108,.061,.071]] as const;
const ORIGINS = {
  // Final-reaction local space: use the existing torso latitude/capsule
  // rings, including authored sink, rather than its unsunk center height.
  grunt: [[0,.25,0],[.03,.34,-.02],[-.13,.25,.055],[.13,.25,-.04]],
  heavy: [[0,.19,.17],[-.10,.245,.05],[-.16,.19,.16],[.16,.19,-.16],[0,.44,.025]],
  giant: [[-.25,.28,.12],[.03,.63,0],[-.285,.63,.08],[.285,.63,-.08],[-.08,.72,.03],[.25,.29,-.10],[0,.83,.02]],
} as const;

function authoredOrigin(role: EnemyDeathRole, variant: number, piece: number): readonly [number, number, number] {
  const [x,y,z] = ORIGINS[role][piece];
  if (variant === 0) return [x,y,z];
  if (variant === 1) return [x*.65 + .025*Math.sin(piece*2), y + .035*Math.cos(piece*2.4), z-.02];
  return [x+.035*Math.cos(piece+1), y+.025*Math.sin(piece*2+1), z+.025*Math.sin(piece+2)];
}
function authoredKick(variant: number, piece: number): readonly [number, number, number] {
  const side = piece % 2 ? -1 : 1;
  return variant === 0 ? [side*.85,.15,(piece%3-1)*.25]
    : variant === 1 ? [side*.3,(piece%3-1)*.7,side*.55]
    : [side*.60,.25,(piece%3-1)*.45];
}
const ORIGIN_CACHE = Object.fromEntries((['grunt','heavy','giant'] as const).map(role => [role,
  Array.from({length:3},(_,variant)=>ORIGINS[role].map((_,piece)=>authoredOrigin(role,variant,piece)))])) as Record<EnemyDeathRole, (readonly [number,number,number])[][]>;
const KICK_CACHE = Array.from({length:3},(_,variant)=>Array.from({length:7},(_,piece)=>authoredKick(variant,piece)));
export const bloodPieceOrigin = (role:EnemyDeathRole, variant:number, piece:number) => ORIGIN_CACHE[role][variant][piece];
export const bloodPieceKick = (variant:number, piece:number) => KICK_CACHE[variant][piece];

// CPU mirror of the shader contact equation. Writes into one reusable scratch
// buffer: origin XYZ, floor, velocityY, flight seconds, landing XZ. No per-piece
// Objects/vectors are allocated at spawn or while evaluating flight.
export function writeBloodFlight(role:EnemyDeathRole,variant:number,piece:number,matrix:THREE.Matrix4,
  expansion:number,gravity:number,deathX:number,deathZ:number,out:Float64Array):void {
  const o=bloodPieceOrigin(role,variant,piece),k=bloodPieceKick(variant,piece),h=HALF_EXTENTS[piece%3],m=matrix.elements;
  const x=o[0]+k[0]*expansion,y=o[1]+k[1]*expansion,z=o[2]+k[2]*expansion;
  out[0]=m[0]*x+m[4]*y+m[8]*z+m[12];out[1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[2]=m[2]*x+m[6]*y+m[10]*z+m[14];
  out[3]=.025+1.15*(Math.abs(m[1])*h[0]+Math.abs(m[5])*h[1]+Math.abs(m[9])*h[2]);
  out[4]=.18-.16*(piece%3)+.04*(variant-1);
  out[5]=(out[4]+Math.sqrt(out[4]*out[4]+2*gravity*Math.max(0,out[1]-out[3])))/gravity;
  out[6]=deathX+k[0]*.025;out[7]=deathZ+k[2]*.025;
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
    const halves=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)halves[i*3+axis]=HALF_EXTENTS[piece%3][axis];
    geometry.setAttribute('bloodHalfExtents',new THREE.BufferAttribute(halves,3));
    const origins=new Float32Array(p.count*3),origin=ORIGINS[role][piece];
    for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)origins[i*3+axis]=origin[axis];
    geometry.setAttribute('bloodOrigin',new THREE.BufferAttribute(origins,3));
    return geometry;
  });
  const geometry=mergeGeometries(parts); parts.forEach(g=>g.dispose());
  if(!geometry)throw new Error('Blood pieces must share a static role batch');
  return geometry;
}

interface BloodSlot { id:number; role:EnemyDeathRole; startedAt:number; matrix:THREE.Matrix4; variant:number;
  gravity:number; expansion:number; contactAgeMs:number; endAgeMs:number; deathX:number; deathZ:number; stainX:number; stainZ:number; stained:boolean }
interface BloodBatch { mesh:THREE.InstancedMesh; age:THREE.InstancedBufferAttribute; gravity:THREE.InstancedBufferAttribute; contact:THREE.InstancedBufferAttribute; expansion:THREE.InstancedBufferAttribute; variant:THREE.InstancedBufferAttribute; count:number }

// One merged blood geometry/draw per active role. All slots/matrices are allocated
// at renderer construction, never a mesh, timer or hierarchy per blood piece.
export class IntegratedDeathBlood {
  private readonly slots:BloodSlot[]=Array.from({length:DEATH_BLOOD_CAPACITY},()=>({id:-1,role:'grunt',startedAt:-Infinity,matrix:new THREE.Matrix4(),variant:0,
    gravity:18,expansion:0,contactAgeMs:Infinity,endAgeMs:Infinity,deathX:0,deathZ:0,stainX:0,stainZ:0,stained:false}));
  private readonly flight=new Float64Array(8);
  private readonly batches=new Map<EnemyDeathRole,BloodBatch>();
  private cursor=0;
  constructor(private readonly scene:THREE.Scene,private readonly stains?:GroundBloodStains) {
    for(const role of ['grunt','heavy','giant'] as const) {
      const geometry=integratedBloodGeometry(role),attribute=()=>new THREE.InstancedBufferAttribute(new Float32Array(DEATH_BLOOD_CAPACITY),1);
      const age=attribute(),gravity=attribute(),contact=new THREE.InstancedBufferAttribute(new Float32Array(DEATH_BLOOD_CAPACITY*2),2),expansion=attribute(),variant=attribute();
      geometry.setAttribute('bloodAge',age);geometry.setAttribute('bloodGravity',gravity);geometry.setAttribute('bloodContact',contact);geometry.setAttribute('bloodExpansion',expansion);geometry.setAttribute('bloodVariant',variant);
      const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,transparent:true,depthWrite:false});
      material.onBeforeCompile=shader=>{
        shader.uniforms.bloodSplit={value:ENEMY_DEATH_TIMING[role].breakupStartMs/1000};
        shader.uniforms.bloodRelease={value:ENEMY_DEATH_TIMING[role].totalMs*BLOOD_RELEASE_FRACTION/1000};
        shader.vertexShader=`attribute float bloodAge; attribute float bloodGravity; attribute vec2 bloodContact; attribute float bloodExpansion; attribute float bloodVariant;
attribute vec3 bloodOrigin; attribute float bloodPieceId; attribute vec3 bloodHalfExtents;
uniform float bloodSplit; uniform float bloodRelease;
varying float vBloodOpacity;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 origin = bloodOrigin;
float side = mod(bloodPieceId,2.) < .5 ? 1. : -1.;
vec3 kick = vec3(side*.85,.15,(mod(bloodPieceId,3.)-1.)*.25);
if (bloodVariant > .5 && bloodVariant < 1.5) {
  origin = vec3(origin.x*.65+.025*sin(bloodPieceId*2.),origin.y+.035*cos(bloodPieceId*2.4),origin.z-.02);
  kick = vec3(side*.3,(mod(bloodPieceId,3.)-1.)*.7,side*.55);
} else if (bloodVariant > 1.5) {
  origin += vec3(.035*cos(bloodPieceId+1.),.025*sin(bloodPieceId*2.+1.),.025*sin(bloodPieceId+2.));
  kick = vec3(side*.60,.25,(mod(bloodPieceId,3.)-1.)*.45);
}
float reveal = smoothstep(bloodSplit,bloodRelease,bloodAge);
vec3 center = (instanceMatrix * vec4(origin + kick * bloodExpansion * reveal,1.)).xyz;
vec3 releaseOrigin = (instanceMatrix * vec4(origin + kick * bloodExpansion,1.)).xyz;
// A small static variant-specific size/orientation change, never a spinning blob.
float shapeScale = 1. + .08*sin(bloodPieceId*2.1+bloodVariant*2.4);
float shapeAngle = .08*sin(bloodPieceId+bloodVariant*2.);
transformed *= shapeScale;
transformed.xz = mat2(cos(shapeAngle),sin(shapeAngle),-sin(shapeAngle),cos(shapeAngle))*transformed.xz;
float floorY = .025 + 1.15*dot(vec3(abs(instanceMatrix[0].y),abs(instanceMatrix[1].y),abs(instanceMatrix[2].y)),bloodHalfExtents);
float velocityY = .18 - .16 * mod(bloodPieceId,3.) + .04*(bloodVariant-1.);
float contactSeconds = (velocityY + sqrt(velocityY*velocityY + 2.*bloodGravity*max(0.,releaseOrigin.y-floorY))) / bloodGravity;
float flightAge = max(0.,bloodAge-bloodRelease);
float flight = min(flightAge,contactSeconds);
if (bloodAge >= bloodRelease) {
  vec2 landing = bloodContact + kick.xz * .025;
  center.xz = mix(releaseOrigin.xz,landing,flight/max(.001,contactSeconds));
  center.y = max(floorY,releaseOrigin.y+velocityY*flight-.5*bloodGravity*flight*flight);
}
// Convert world-center motion back into local translation using the inverse
// linear transform (rotation/scale only); project_vertex still owns instancing.
mat3 linear = mat3(instanceMatrix);
transformed += inverse(linear) * (center - instanceMatrix[3].xyz);
vBloodOpacity = smoothstep(bloodSplit,bloodSplit+.035,bloodAge) * (1.-smoothstep(contactSeconds,contactSeconds+.065,flightAge));`);
        shader.fragmentShader=`varying float vBloodOpacity;\n${shader.fragmentShader}`.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vBloodOpacity;');
      };
      material.customProgramCacheKey=()=> `integrated-falling-blood-v2-${role}`;
      const mesh=new THREE.InstancedMesh(geometry,material,DEATH_BLOOD_CAPACITY);
      mesh.name=`enemy-3d-blood-${role}`;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
      this.batches.set(role,{mesh,age,gravity,contact,expansion,variant,count:0});
    }
  }
  spawn(id:number,role:EnemyDeathRole,nowMs:number,bodyWorld:THREE.Matrix4,deathX=bodyWorld.elements[12],deathZ=bodyWorld.elements[14]):void {
    let index=this.cursor;
    for(let n=0;n<DEATH_BLOOD_CAPACITY;n++){const candidate=(this.cursor+n)%DEATH_BLOOD_CAPACITY,slot=this.slots[candidate];if(nowMs>=slot.startedAt+ENEMY_DEATH_TIMING[slot.role].totalMs){index=candidate;break;}}
    const slot=this.slots[index];slot.id=id;slot.role=role;slot.startedAt=nowMs;slot.matrix.copy(bodyWorld);slot.variant=deathVariant(id);this.cursor=(index+1)%DEATH_BLOOD_CAPACITY;
    const m=bodyWorld.elements,scale=Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
    slot.expansion=BLOOD_EXPANSION[role]/Math.max(.001,scale);slot.gravity=GRAVITY[role];slot.deathX=deathX;slot.deathZ=deathZ;slot.stained=false;
    const targetFlight=ENEMY_DEATH_TIMING[role].totalMs*.33/1000;
    for(let piece=0;piece<BLOOD_PIECE_COUNTS[role];piece++){
      writeBloodFlight(role,slot.variant,piece,bodyWorld,slot.expansion,slot.gravity,deathX,deathZ,this.flight);
      slot.gravity=Math.max(slot.gravity,2*(Math.max(0,this.flight[1]-this.flight[3])+this.flight[4]*targetFlight)/(targetFlight*targetFlight));
    }
    slot.contactAgeMs=Infinity;slot.endAgeMs=0;
    const release=ENEMY_DEATH_TIMING[role].totalMs*BLOOD_RELEASE_FRACTION;
    for(let piece=0;piece<BLOOD_PIECE_COUNTS[role];piece++){
      writeBloodFlight(role,slot.variant,piece,bodyWorld,slot.expansion,slot.gravity,deathX,deathZ,this.flight);
      const contact=release+this.flight[5]*1000;
      if(piece<2&&contact<slot.contactAgeMs){slot.contactAgeMs=contact;slot.stainX=this.flight[6];slot.stainZ=this.flight[7];}
      slot.endAgeMs=Math.max(slot.endAgeMs,contact+BLOOD_CONTACT_FADE_MS);
    }
  }
  update(nowMs:number):void {
    for(const batch of this.batches.values())batch.count=0;
    for(const slot of this.slots) {
      if(!Number.isFinite(slot.startedAt))continue;
      const age=nowMs-slot.startedAt,timing=ENEMY_DEATH_TIMING[slot.role];
      if(!slot.stained&&nowMs>=slot.startedAt+slot.contactAgeMs){this.stains?.activate(slot.id,slot.role,slot.stainX,slot.stainZ,slot.startedAt+slot.contactAgeMs);slot.stained=true;}
      if(age<timing.breakupStartMs||age>=slot.endAgeMs)continue;
      const batch=this.batches.get(slot.role)!,index=batch.count++;
      batch.mesh.setMatrixAt(index,slot.matrix);batch.variant.setX(index,slot.variant);
      batch.age.setX(index,age/1000);batch.gravity.setX(index,slot.gravity);batch.contact.setXY(index,slot.deathX,slot.deathZ);batch.expansion.setX(index,slot.expansion);
    }
    for(const batch of this.batches.values()){batch.mesh.count=batch.count;batch.mesh.visible=batch.count>0;batch.mesh.instanceMatrix.needsUpdate=true;batch.age.needsUpdate=batch.gravity.needsUpdate=batch.contact.needsUpdate=batch.expansion.needsUpdate=batch.variant.needsUpdate=true;}
  }
  reset():void {this.slots.forEach(slot=>slot.startedAt=-Infinity);this.cursor=0;for(const b of this.batches.values()){b.mesh.count=0;b.mesh.visible=false;}}
  dispose():void {for(const {mesh}of this.batches.values()){this.scene.remove(mesh);mesh.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
