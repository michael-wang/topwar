import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ENEMY_DEATH_TIMING, enemyFragmentOpacity, type EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const SHATTER_CAPACITY = 384;
export const SHATTER_FRAGMENTS_PER_DEATH = 8;
export const SHATTER_COLORS = ['#929a98', '#a6acaa', '#858e8c'] as const;
const colors = SHATTER_COLORS.map(color => new THREE.Color(color));
// Five curved chunks and three structured chunks per role: helmet/body/boots,
// plus gear or crest/maul. Coordinates belong to the current authored toy forms.
type Chunk = readonly [shape: 0 | 1, part: 'body' | 'helmet' | 'weapon', x: number, y: number, z: number,
  rx: number, ry: number, rz: number];
const chunks: Record<EnemyDeathRole, readonly Chunk[]> = {
  grunt: [[0,'helmet',0,.80,0,.30,.18,.26], [1,'body',-.11,.41,0,.22,.22,.30],
    [1,'body',.11,.28,0,.21,.20,.28], [0,'body',-.18,.075,.10,.13,.06,.11],
    [0,'body',.18,.075,-.10,.13,.06,.11], [0,'body',-.34,.365,.10,.057,.057,.057],
    [0,'body',.34,.365,-.10,.057,.057,.057], [1,'body',-.25,.26,.04,.09,.11,.09]],
  heavy: [[0,'helmet',0,.79,0,.36,.20,.32], [1,'body',-.14,.45,0,.34,.26,.43],
    [1,'body',.14,.30,0,.32,.25,.40], [0,'body',-.28,.09,.10,.17,.075,.135],
    [0,'body',.28,.09,-.10,.17,.075,.135], [0,'body',-.495,.34,.10,.13,.13,.13],
    [0,'body',.495,.34,-.10,.13,.13,.13], [1,'body',.245,.245,.235,.18,.155,.10]],
  giant: [[0,'helmet',0,1.10,0,.26,.20,.23], [1,'helmet',0,1.235,0,.14,.22,.29],
    [1,'body',-.16,.67,0,.43,.42,.48], [0,'body',.15,.40,0,.28,.24,.25],
    [0,'body',-.28,.10,.10,.20,.09,.16], [0,'body',.28,.10,-.10,.20,.09,.16],
    [0,'weapon',.60,.77,.08,.23,.175,.19], [1,'body',-.37,.33,.205,.245,.275,.12]],
};
export function shatterDirection(id: number, index: number, target = { x: 0, y: 0, z: 0 }) {
  const seed = Math.imul(id ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b) >>> 0;
  const angle = seed / 0x100000000 * Math.PI * 2;
  target.x = Math.cos(angle); target.y = .12 + index % 3 * .08; target.z = Math.sin(angle); return target;
}

// No ballistic/ground state: captured silhouette pieces expand briefly and fade.
// Fixed batch capacities add up to 384 (48 eight-piece deaths), not 384 per shape.
export class EnemyShatterBurst {
  private readonly births = new Float64Array(SHATTER_CAPACITY).fill(-Infinity);
  private readonly lifetimes = new Float32Array(SHATTER_CAPACITY);
  private readonly shapes = new Uint8Array(SHATTER_CAPACITY);
  private readonly origins = new Float32Array(SHATTER_CAPACITY * 3);
  private readonly expansion = new Float32Array(SHATTER_CAPACITY * 3);
  private readonly scales = new Float32Array(SHATTER_CAPACITY * 3);
  private readonly rotations = new Float32Array(SHATTER_CAPACITY * 4);
  private readonly fades = [240,144].map(capacity => new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  private readonly geometries = [new THREE.SphereGeometry(1,8,5), new RoundedBoxGeometry(1,1,1,1,.22)];
  private readonly materials: THREE.MeshStandardMaterial[];
  readonly meshes: THREE.InstancedMesh[];
  private readonly transform = new THREE.Object3D();
  private readonly point = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly direction = { x: 0, y: 0, z: 0 };
  private readonly counts = [0,0];
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene) {
    this.materials = this.geometries.map((geometry, index) => {
      geometry.setAttribute('shatterFade',this.fades[index]);
      const material = new THREE.MeshStandardMaterial({ color:'white', roughness:1, metalness:0,
        transparent:true, depthWrite:false, emissiveIntensity:0 });
      material.onBeforeCompile = shader => {
        shader.vertexShader = `attribute float shatterFade; varying float vShatterFade;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvShatterFade = shatterFade;');
        shader.fragmentShader = `varying float vShatterFade;\n${shader.fragmentShader}`
          .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vShatterFade;');
      };
      material.customProgramCacheKey = () => 'enemy-shatter-fade-v1'; return material;
    });
    this.meshes = this.geometries.map((geometry,index) => {
      const mesh = new THREE.InstancedMesh(geometry,this.materials[index],this.fades[index].count);
      mesh.name = index === 0 ? 'enemy-shatter-rounded' : 'enemy-shatter-structured';
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.fades[index].setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh); return mesh;
    });
  }
  spawn(id: number, role: EnemyDeathRole, frozen: THREE.Group, lethalAtMs: number): void {
    frozen.updateMatrixWorld(true);
    const timing = ENEMY_DEATH_TIMING[role];
    for (let index=0;index<SHATTER_FRAGMENTS_PER_DEATH;index++) {
      const [shape,part,x,y,z,rx,ry,rz] = chunks[role][index];
      const source = part === 'helmet' ? frozen.children[1] : part === 'weapon'
        ? frozen.getObjectByName('giant-maul')?.children[0] : frozen.children[0];
      const matrix = source?.matrixWorld ?? frozen.matrixWorld;
      const slot = this.cursor, offset = slot*3;
      this.cursor = (slot+1)%SHATTER_CAPACITY;
      this.births[slot] = lethalAtMs + timing.shatterMs;
      this.lifetimes[slot] = timing.totalMs-timing.shatterMs; this.shapes[slot] = shape;
      this.point.set(x,y,z).applyMatrix4(matrix); this.point.toArray(this.origins,offset);
      matrix.decompose(this.point,this.rotation,this.scale);
      this.scales[offset]=rx*this.scale.x; this.scales[offset+1]=ry*this.scale.y; this.scales[offset+2]=rz*this.scale.z;
      this.rotation.toArray(this.rotations,slot*4);
      const direction = shatterDirection(id,index,this.direction);
      this.expansion[offset]=direction.x*timing.spread; this.expansion[offset+1]=direction.y*timing.spread;
      this.expansion[offset+2]=direction.z*timing.spread;
    }
  }
  update(nowMs: number): void {
    const counts = this.counts; counts[0] = counts[1] = 0;
    for (let slot=0;slot<SHATTER_CAPACITY;slot++) {
      const age=nowMs-this.births[slot];
      if (age>=this.lifetimes[slot]) { this.births[slot]=-Infinity; continue; }
      if (age<0) continue;
      const progress=age/this.lifetimes[slot], travel=1-Math.pow(1-progress,3), offset=slot*3;
      this.transform.position.set(this.origins[offset]+this.expansion[offset]*travel,
        this.origins[offset+1]+this.expansion[offset+1]*travel,this.origins[offset+2]+this.expansion[offset+2]*travel);
      this.transform.quaternion.fromArray(this.rotations,slot*4);
      this.transform.scale.fromArray(this.scales,offset); // Full authored size throughout; opacity alone clears it.
      this.transform.updateMatrix();
      const shape=this.shapes[slot], count=counts[shape]++, mesh=this.meshes[shape];
      mesh.setMatrixAt(count,this.transform.matrix); mesh.setColorAt(count,colors[slot%colors.length]);
      this.fades[shape].setX(count,enemyFragmentOpacity(progress));
    }
    this.meshes.forEach((mesh,index) => {
      mesh.count=counts[index]; mesh.visible=mesh.count>0; mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true; this.fades[index].needsUpdate=true;
    });
  }
  reset(): void { this.births.fill(-Infinity); this.cursor=0; this.meshes.forEach(mesh => {mesh.count=0;mesh.visible=false;}); }
  dispose(): void {
    this.meshes.forEach(mesh => {this.scene.remove(mesh);mesh.dispose();});
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
