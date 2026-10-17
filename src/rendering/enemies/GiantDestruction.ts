import * as THREE from 'three';
import { EXPLOSION_SMOKE, explosionSmokeGeometry, prepareExplosionSmoke, poseExplosionSmoke,
  explosionSmokeOpacity, smokeIsDark } from '../ExplosionSmoke';

const SMOKE = EXPLOSION_SMOKE.giant;
/** One slot's two bounded draws. Anchors detach from the falling robot; no spawned objects, physics or timers. */
export class GiantDestruction {
  private readonly sphere = new THREE.SphereGeometry(1, 8, 5);
  private readonly smokeGeometry = explosionSmokeGeometry(this.sphere, SMOKE);
  private readonly burstGeometry = this.sphere.clone();
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
  private readonly burstMaterial = new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
  private readonly smoke = new THREE.InstancedMesh(this.smokeGeometry, this.smokeMaterial, SMOKE.count);
  private readonly burst = new THREE.InstancedMesh(this.burstGeometry, this.burstMaterial, 10);
  private readonly alpha = new THREE.InstancedBufferAttribute(new Float32Array(10), 1).setUsage(THREE.DynamicDrawUsage);
  private readonly smokeAge = prepareExplosionSmoke(this.smoke, SMOKE);
  private readonly pose = new THREE.Object3D();
  private readonly anchor = new THREE.Vector3();
  private startedAt = -Infinity;
  private scale = 1;
  constructor(private readonly scene: THREE.Scene) {
    this.smoke.name = 'giant-destruction-smoke'; this.burst.name = 'giant-destruction-burst';
    this.burstGeometry.setAttribute('destructionAlpha', this.alpha);
    this.burstMaterial.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float destructionAlpha; varying float vDestructionAlpha;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDestructionAlpha = destructionAlpha;');
      shader.fragmentShader = `varying float vDestructionAlpha;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDestructionAlpha;');
    };
    this.burstMaterial.customProgramCacheKey = () => 'giant-destruction-burst';
    const color = new THREE.Color();
    for (let i=0;i<10;i++) this.burst.setColorAt(i,color.set(i===0?'#f19332':i===1?'#fff1a1':'#ffe34f'));
    for (const mesh of [this.smoke,this.burst]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
    }
    this.reset();
  }
  present(matrix: THREE.Matrix4, nowMs: number): void {
    this.anchor.set(0,.65,0).applyMatrix4(matrix);
    const m=matrix.elements; this.scale=Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
    this.startedAt=nowMs;
  }
  update(nowMs: number): void {
    const t=(nowMs-this.startedAt)/1000,active=t>=0&&t<SMOKE.seconds;
    this.smoke.visible=active; this.burst.visible=active&&t<.55;
    if(!active)return;
    this.smokeAge.value=t;this.smokeMaterial.opacity=explosionSmokeOpacity(t,SMOKE);
    for(let i=0;i<SMOKE.count;i++){
      poseExplosionSmoke(this.pose,i,smokeIsDark(i,SMOKE),t,this.scale*.8,this.anchor.x,this.anchor.z,SMOKE);
      this.pose.position.y+=this.anchor.y-.4;this.pose.updateMatrix();this.smoke.setMatrixAt(i,this.pose.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate=true;
    if(!this.burst.visible)return;
    for(let i=0;i<10;i++){
      if(i<2){
        const fade=Math.max(0,1-t/(i===0?.26:.12));this.alpha.setX(i,fade);
        this.pose.position.set(this.anchor.x,this.anchor.y,this.anchor.z-this.scale*.18);
        const size=this.scale*(i===0?.30:.16)*(1+Math.min(t/.12,1)*.7);
        this.pose.scale.set(size,size*.9,size);this.pose.rotation.set(0,0,0);
      }else{
        const angle=i*2.39996323,p=t/.55;this.alpha.setX(i,Math.max(0,1-p));
        this.pose.position.set(this.anchor.x+Math.cos(angle)*this.scale*t*1.5,
          this.anchor.y+Math.sin(angle)*this.scale*t+this.scale*(t-2*t*t),this.anchor.z-this.scale*(.22+t*.7));
        const size=this.scale*.035*(1-p*.5);this.pose.scale.set(size*2.7,size*.55,size*.6);this.pose.rotation.set(0,angle,angle);
      }
      this.pose.updateMatrix();this.burst.setMatrixAt(i,this.pose.matrix);
    }
    this.alpha.needsUpdate=true;this.burst.instanceMatrix.needsUpdate=true;
  }
  reset(): void { this.startedAt=-Infinity;this.smoke.visible=this.burst.visible=false; }
  dispose(): void {
    this.scene.remove(this.smoke,this.burst);this.smoke.dispose();this.burst.dispose();
    this.sphere.dispose();this.smokeGeometry.dispose();this.burstGeometry.dispose();this.smokeMaterial.dispose();this.burstMaterial.dispose();
  }
}
