import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMY_DEATH_TIMING, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
import { deathVisualSeed, deathComposition } from './DeathVisualSeed';
import { fluidRibbonGeometry, splashShapes, SPLASH_COMPOSITIONS, RIBBON_COUNTS, RIBBON_LIFETIME_MS, RIBBON_DELAY_MS, DROPLET_COUNTS, SPLASH_COLORS, activeRibbonCount, activeDropletCount } from './FluidBloodSplash';
import type { GroundBloodStains } from './BloodSplat';
export const DEATH_BLOOD_CAPACITY = 64;
export const DEATH_BLOOD_COLORS = SPLASH_COLORS;
export const BLOOD_PIECE_COUNTS = DROPLET_COUNTS;
export const BLOOD_RELEASE_MS = { grunt: 190, heavy: 380, giant: 890 } as const;
export const BLOOD_GRAVITY = { grunt: 30, heavy: 12, giant: 6 } as const;
export const BLOOD_CONTACT_FADE_MS = 65;
export const bloodPieceScale=(role:EnemyDeathRole,piece:number)=>({grunt:1,heavy:1.12,giant:1.20})[role]*(.82+.24*(1+Math.sin(piece*2.3))/2);
const parameters=Object.fromEntries((['grunt','heavy','giant'] as const).map(role=>[role,
 Array.from({length:SPLASH_COMPOSITIONS},(_,variant)=>Array.from({length:BLOOD_PIECE_COUNTS[role]},(_,piece)=>{
  const ribbon=splashShapes[role][variant][piece%activeRibbonCount(role,variant)],direction=ribbon.direction;
  const origin=ribbon.origin.clone().addScaledVector(direction,ribbon.length*(piece<2?.46:.25));
  const velocity=direction.clone().multiplyScalar(({grunt:3,heavy:3.6,giant:3.8})[role]*(.78+.18*Math.sin(piece*1.7+variant)));
  velocity.y=Math.max(.7,velocity.y)+.8;velocity.z+=.25*Math.sin(piece*2.1+variant);
  const half=new THREE.Vector3(.048,.058,.046).multiplyScalar(bloodPieceScale(role,piece)*1.12);
  return {origin,velocity,half};
 }))])) as Record<EnemyDeathRole,{origin:THREE.Vector3;velocity:THREE.Vector3;half:THREE.Vector3}[][]>;
export const bloodPieceOrigin=(role:EnemyDeathRole,variant:number,piece:number)=>splashShapes[role][variant][piece%activeRibbonCount(role,variant)].origin.toArray();
const KICKS=Array.from({length:SPLASH_COMPOSITIONS},(_,variant)=>Array.from({length:10},(_,piece)=>[piece%2?-1:1,.15,Math.sin(piece+variant)*.25]));
export const bloodPieceKick=(variant:number,piece:number)=>KICKS[variant][piece];
export const bloodPieceVelocity=(role:EnemyDeathRole,variant:number,piece:number)=>parameters[role][variant][piece].velocity.toArray();
// Exact CPU mirror of the shader; the pool owns one reusable scratch buffer.
export function writeBloodFlight(role:EnemyDeathRole,variant:number,piece:number,matrix:THREE.Matrix4,gravity:number,out:Float64Array,jitter=.5):void {
 const {origin:o,velocity:v,half:h}=parameters[role][variant][piece],m=matrix.elements;
 const ox=o.x+.018*(jitter-.5),size=.9+.2*jitter,aspect=.9+.2*Math.sin(jitter*6.28+piece),speed=.92+.16*jitter;
 out[0]=m[0]*ox+m[4]*o.y+m[8]*o.z+m[12];out[1]=m[1]*ox+m[5]*o.y+m[9]*o.z+m[13];out[2]=m[2]*ox+m[6]*o.y+m[10]*o.z+m[14];
 out[3]=.025+size*(Math.abs(m[1])*h.x+Math.abs(m[5])*h.y*aspect+Math.abs(m[9])*h.z);
 const scale=Math.max(.001,Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
 const vx=(m[0]*v.x+m[8]*v.z)/scale*speed,vz=(m[2]*v.x+m[10]*v.z)/scale*speed,vy=v.y*speed;
 out[1]=Math.max(out[1],out[3]);out[4]=vy;out[8]=vx;out[9]=vy;out[10]=vz;
 out[5]=(vy+Math.sqrt(vy*vy+2*gravity*Math.max(0,out[1]-out[3])))/gravity;
 out[6]=out[0]+vx*out[5];out[7]=out[2]+vz*out[5];
}
export function integratedBloodGeometry(role:EnemyDeathRole):THREE.BufferGeometry {
 const parts=Array.from({length:BLOOD_PIECE_COUNTS[role]},(_,piece)=>{
  const source=new THREE.SphereGeometry(1,8,4),p=source.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=1+.08*Math.sin(x*3+y*2+piece);p.setXYZ(i,x*.040*w*bloodPieceScale(role,piece),y*.052*w*bloodPieceScale(role,piece),z*.039*w*bloodPieceScale(role,piece));}
  source.computeVertexNormals();const g=source.toNonIndexed();source.dispose();g.deleteAttribute('uv');
  const count=g.getAttribute('position').count,c=new THREE.Color(DEATH_BLOOD_COLORS[piece%3]),colors=new Float32Array(count*3);
  for(let i=0;i<count;i++)c.toArray(colors,i*3);
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('bloodPieceId',new THREE.BufferAttribute(new Float32Array(count).fill(piece),1));return g;
 });const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geometry;
}
interface BloodSlot { id:number; role:EnemyDeathRole; startedAt:number; matrix:THREE.Matrix4; variant:number;
  gravity:number; contactAgeMs:number; endAgeMs:number; visualSeed:number; jitter:number; deathX:number; deathZ:number; stainX:number; stainZ:number; stained:boolean }
interface BloodBatch { mesh:THREE.InstancedMesh; age:THREE.InstancedBufferAttribute; gravity:THREE.InstancedBufferAttribute; variant:THREE.InstancedBufferAttribute; jitter:THREE.InstancedBufferAttribute; count:number }

// Two merged draws per active role: stretching tongues and detached droplets. All slots/matrices are allocated
// at renderer construction, never a mesh, timer or hierarchy per blood piece.
export class IntegratedDeathBlood {
  private readonly slots:BloodSlot[]=Array.from({length:DEATH_BLOOD_CAPACITY},()=>({id:-1,role:'grunt',startedAt:-Infinity,matrix:new THREE.Matrix4(),variant:0,
    gravity:18,contactAgeMs:Infinity,endAgeMs:Infinity,visualSeed:0,jitter:.5,deathX:0,deathZ:0,stainX:0,stainZ:0,stained:false}));
  private readonly flight=new Float64Array(11);
  private readonly batches=new Map<EnemyDeathRole,BloodBatch>();
  private readonly allBatches:BloodBatch[]=[];
  private cursor=0;
  private readonly ribbons=new Map<EnemyDeathRole,BloodBatch>();
  constructor(private readonly scene:THREE.Scene,private readonly stains?:GroundBloodStains) {
    for(const role of ['grunt','heavy','giant'] as const){this.batches.set(role,this.createBatch(role,false));this.ribbons.set(role,this.createBatch(role,true));this.allBatches.push(this.batches.get(role)!,this.ribbons.get(role)!);}
  }
  private createBatch(role:EnemyDeathRole,ribbon:boolean):BloodBatch {
    const geometry=ribbon?fluidRibbonGeometry(role):integratedBloodGeometry(role),attribute=()=>new THREE.InstancedBufferAttribute(new Float32Array(DEATH_BLOOD_CAPACITY),1);
    const age=attribute(),gravity=attribute(),variant=attribute(),jitter=attribute();
    geometry.setAttribute('bloodAge',age);geometry.setAttribute('bloodGravity',gravity);geometry.setAttribute('bloodVariant',variant);geometry.setAttribute('bloodJitter',jitter);
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:ribbon?THREE.DoubleSide:THREE.FrontSide,transparent:true,depthWrite:false});
    material.forceSinglePass=true;
    const count=ribbon?RIBBON_COUNTS[role]:BLOOD_PIECE_COUNTS[role],tableSize=count*SPLASH_COMPOSITIONS;
    material.onBeforeCompile=shader=>{
      const flat=splashShapes[role].flat(),drops=parameters[role].flat();
      shader.uniforms.origins={value:ribbon?flat.map(p=>p.origin):drops.map(p=>p.origin)};
      shader.uniforms.vectors={value:ribbon?flat.map(p=>p.direction):drops.map(p=>p.velocity)};
      shader.uniforms.shapes={value:ribbon?flat.map(p=>new THREE.Vector4(p.length,p.width,p.bend,p.delay)):drops.map(p=>new THREE.Vector4(p.half.x,p.half.y,p.half.z,0))};
      shader.uniforms.compositionCounts={value:Array.from({length:SPLASH_COMPOSITIONS},(_,c)=>ribbon?activeRibbonCount(role,c):activeDropletCount(role,c))};
      shader.vertexShader=`attribute float bloodPieceId; attribute float bloodAge; attribute float bloodGravity; attribute float bloodVariant; attribute float bloodJitter;
        uniform vec3 origins[${tableSize}]; uniform vec3 vectors[${tableSize}]; uniform vec4 shapes[${tableSize}]; uniform float compositionCounts[${SPLASH_COMPOSITIONS}]; varying float vBloodOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>',`#include <begin_vertex>
int param=int(bloodVariant)*${count}+int(bloodPieceId);
vec3 origin=origins[param], direction=vectors[param], shape=shapes[param].xyz;
origin.x+=.018*(bloodJitter-.5);float size=.9+.2*bloodJitter;
${ribbon?`
float t=(bloodAge-shapes[param].w-${ENEMY_DEATH_TIMING[role].breakupStartMs/1000})/${RIBBON_LIFETIME_MS[role]/1000};
float grow=1.-pow(1.-clamp(t/.34,0.,1.),3.);
float thin=1.-.82*smoothstep(.42,1.,t);
vec3 side=normalize(cross(direction,vec3(0.,0.,1.))),depth=cross(direction,side);
float u=position.y;
transformed=origin+direction*(u*shape.x*size*grow)+side*(position.x*shape.y*(.85+.3*bloodJitter)*grow*thin+(shape.z*u*u+.12*sin(u*4.5+bloodPieceId)*u)*grow)+depth*((position.z*shape.y+.07*sin(u*3.2)*u)*grow*thin);
vBloodOpacity=smoothstep(0.,.08,t)*(1.-smoothstep(.46,1.,t));
`:`
float aspect=.9+.2*sin(bloodJitter*6.28+bloodPieceId);
shape*=size;shape.y*=aspect;transformed*=size;transformed.y*=aspect;direction*=.92+.16*bloodJitter;
vec3 releaseOrigin=(instanceMatrix*vec4(origin,1.)).xyz;
float floorY=.025+dot(vec3(abs(instanceMatrix[0].y),abs(instanceMatrix[1].y),abs(instanceMatrix[2].y)),shape);
releaseOrigin.y=max(releaseOrigin.y,floorY);
float rootScale=max(length(instanceMatrix[0].xyz),max(length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)));
vec3 velocity=(mat3(instanceMatrix)*vec3(direction.x,0.,direction.z))/max(.001,rootScale);velocity.y=direction.y;
float contact=(velocity.y+sqrt(velocity.y*velocity.y+2.*bloodGravity*max(0.,releaseOrigin.y-floorY)))/bloodGravity;
float age=max(0.,bloodAge-${BLOOD_RELEASE_MS[role]/1000}),flight=min(age,contact);
vec3 center=releaseOrigin+velocity*flight;center.y=max(floorY,center.y-.5*bloodGravity*flight*flight);
transformed+=inverse(mat3(instanceMatrix))*(center-instanceMatrix[3].xyz);
vBloodOpacity=smoothstep(${BLOOD_RELEASE_MS[role]/1000},${BLOOD_RELEASE_MS[role]/1000+.018},bloodAge)*(1.-smoothstep(contact,contact+.065,age));
`}
vBloodOpacity *= bloodPieceId < compositionCounts[int(bloodVariant)] ? 1. : 0.;`);
      if(ribbon) shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
vec3 normalDirection=vectors[int(bloodVariant)*${count}+int(bloodPieceId)];
vec3 normalSide=normalize(cross(normalDirection,vec3(0.,0.,1.))),normalDepth=cross(normalDirection,normalSide);
objectNormal=normalSide*normal.x+normalDirection*normal.y+normalDepth*normal.z;`);
      shader.fragmentShader=`varying float vBloodOpacity;\n${shader.fragmentShader}`.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vBloodOpacity;');
    };
    material.customProgramCacheKey=()=>`fluid-blood-${ribbon?'ribbon':'droplet'}-${role}-${SPLASH_COMPOSITIONS}`;
    const mesh=new THREE.InstancedMesh(geometry,material,DEATH_BLOOD_CAPACITY);mesh.name=ribbon?`enemy-blood-ribbons-${role}`:`enemy-3d-blood-${role}`;
    mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;this.scene.add(mesh);return {mesh,age,gravity,variant,jitter,count:0};
  }
  spawn(id:number,role:EnemyDeathRole,nowMs:number,bodyWorld:THREE.Matrix4,deathX=bodyWorld.elements[12],deathZ=bodyWorld.elements[14],visualSeed=deathVisualSeed(id,role,0)):void {
    let index=this.cursor;
    for(let n=0;n<DEATH_BLOOD_CAPACITY;n++){const candidate=(this.cursor+n)%DEATH_BLOOD_CAPACITY,slot=this.slots[candidate];if(nowMs>=slot.startedAt+ENEMY_DEATH_TIMING[slot.role].totalMs){index=candidate;break;}}
    const slot=this.slots[index];slot.id=id;slot.role=role;slot.startedAt=nowMs;slot.matrix.copy(bodyWorld);slot.visualSeed=visualSeed;slot.jitter=((visualSeed>>>3)%997)/997;slot.variant=deathComposition(visualSeed);this.cursor=(index+1)%DEATH_BLOOD_CAPACITY;
    slot.gravity=BLOOD_GRAVITY[role];slot.deathX=deathX;slot.deathZ=deathZ;slot.stained=false;
    const targetFlight=(ENEMY_DEATH_TIMING[role].totalMs-BLOOD_RELEASE_MS[role]-BLOOD_CONTACT_FADE_MS-15)/1000;
    for(let piece=0;piece<activeDropletCount(role,slot.variant);piece++){
      writeBloodFlight(role,slot.variant,piece,bodyWorld,slot.gravity,this.flight,slot.jitter);
      slot.gravity=Math.max(slot.gravity,2*(Math.max(0,this.flight[1]-this.flight[3])+this.flight[4]*targetFlight)/(targetFlight*targetFlight));
    }
    slot.contactAgeMs=Infinity;slot.endAgeMs=0;
    const release=BLOOD_RELEASE_MS[role];
    for(let piece=0;piece<activeDropletCount(role,slot.variant);piece++){
      writeBloodFlight(role,slot.variant,piece,bodyWorld,slot.gravity,this.flight,slot.jitter);
      const contact=release+this.flight[5]*1000;
      if(piece<2&&contact<slot.contactAgeMs){slot.contactAgeMs=contact;const kick=bloodPieceKick(slot.variant,piece);slot.stainX=deathX+kick[0]*.025;slot.stainZ=deathZ+kick[2]*.025;}
      slot.endAgeMs=Math.max(slot.endAgeMs,contact+BLOOD_CONTACT_FADE_MS);
    }
  }
  update(nowMs:number):void {
    for(const batch of this.allBatches)batch.count=0;
    for(const slot of this.slots) {
      if(!Number.isFinite(slot.startedAt))continue;
      const age=nowMs-slot.startedAt,timing=ENEMY_DEATH_TIMING[slot.role];
      if(!slot.stained&&nowMs>=slot.startedAt+slot.contactAgeMs){this.stains?.activate(slot.id,slot.role,slot.stainX,slot.stainZ,slot.startedAt+slot.contactAgeMs,slot.visualSeed);slot.stained=true;}
      if(age<timing.breakupStartMs||age>=slot.endAgeMs)continue;
      for(let layer=0;layer<2;layer++) {
      if(layer===0&&age<BLOOD_RELEASE_MS[slot.role])continue;
      const batch=(layer===0?this.batches:this.ribbons).get(slot.role)!;
      if(batch===this.ribbons.get(slot.role)&&age>=timing.breakupStartMs+RIBBON_LIFETIME_MS[slot.role]+RIBBON_DELAY_MS[slot.role])continue;
      const index=batch.count++;
      batch.mesh.setMatrixAt(index,slot.matrix);batch.variant.setX(index,slot.variant);batch.jitter.setX(index,slot.jitter);
      batch.age.setX(index,age/1000);batch.gravity.setX(index,slot.gravity);
      }
    }
    for(const batch of this.allBatches){batch.mesh.count=batch.count;batch.mesh.visible=batch.count>0;batch.mesh.instanceMatrix.needsUpdate=true;batch.age.needsUpdate=batch.gravity.needsUpdate=batch.variant.needsUpdate=batch.jitter.needsUpdate=true;}
  }
  reset():void {this.slots.forEach(slot=>slot.startedAt=-Infinity);this.cursor=0;for(const b of this.allBatches){b.mesh.count=0;b.mesh.visible=false;}}
  dispose():void {for(const {mesh}of this.allBatches){this.scene.remove(mesh);mesh.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
