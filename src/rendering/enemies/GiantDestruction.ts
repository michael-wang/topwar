import * as THREE from 'three';
import { smokeWindX } from '../../presentation/BattlefieldWind';
import { EXPLOSION_SMOKE, poseExplosionSmoke, explosionSmokeOpacity, smokeIsDark } from '../ExplosionSmoke';

const SMOKE = EXPLOSION_SMOKE.giant;
const SMOKE_COUNT = SMOKE.count + 8, BURST_COUNT = 14;
// Both existing GIANT draws use per-instance opacity; no extra particle system.
function prepareAlpha(material: THREE.MeshBasicMaterial): void {
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float destructionAlpha; varying float vDestructionAlpha;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDestructionAlpha = destructionAlpha;');
    shader.fragmentShader = `varying float vDestructionAlpha;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDestructionAlpha;');
  };
  material.customProgramCacheKey = () => 'giant-destruction-alpha';
}

/** One slot's two bounded draws. All effects detach and follow absolute presentation age. */
export class GiantDestruction {
  private readonly sphere = new THREE.SphereGeometry(1, 8, 5);
  private readonly smokeGeometry = this.sphere.clone();
  private readonly burstGeometry = this.sphere.clone();
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
  private readonly burstMaterial = new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
  private readonly smoke = new THREE.InstancedMesh(this.smokeGeometry, this.smokeMaterial, SMOKE_COUNT);
  private readonly burst = new THREE.InstancedMesh(this.burstGeometry, this.burstMaterial, BURST_COUNT);
  private readonly alpha = new THREE.InstancedBufferAttribute(new Float32Array(BURST_COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  private readonly smokeAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  private readonly pose = new THREE.Object3D();
  private readonly anchor = new THREE.Vector3();
  private readonly wreckSources = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly wreckStarts = new Float64Array(2);
  private startedAt = -Infinity;
  private scale = 1;
  constructor(private readonly scene: THREE.Scene) {
    this.smoke.name = 'giant-destruction-smoke'; this.burst.name = 'giant-destruction-burst';
    this.burstGeometry.setAttribute('destructionAlpha', this.alpha);
    this.smokeGeometry.setAttribute('destructionAlpha', this.smokeAlpha);
    prepareAlpha(this.burstMaterial); prepareAlpha(this.smokeMaterial);
    const color = new THREE.Color();
    for (let i=0;i<BURST_COUNT;i++) this.burst.setColorAt(i,color.set(i>=10?(i%2?'#ffd778':'#e98929'):i===0?'#f19332':i===1?'#fff1a1':'#ffe34f'));
    for (let i=0;i<SMOKE_COUNT;i++) this.smoke.setColorAt(i,color.set((i<SMOKE.count?smokeIsDark(i,SMOKE):i%2===1)?SMOKE.darkColor:SMOKE.lightColor));
    for (const mesh of [this.smoke,this.burst]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
    }
    this.reset();
  }
  present(matrix: THREE.Matrix4, nowMs: number): void {
    this.anchor.set(0,.65,0).applyMatrix4(matrix);
    const m=matrix.elements; this.scale=Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
    this.startedAt=nowMs;
    for(let i=0;i<2;i++){
      this.wreckSources[i].set(i?-.12:.12,0,0).applyMatrix4(matrix);this.wreckSources[i].y=.035;
      this.wreckStarts[i]=.95;
    }
  }
  setWreckSource(index: number, point: THREE.Vector3, landingAgeMs: number): void {
    this.wreckSources[index].copy(point);this.wreckStarts[index]=landingAgeMs/1000;
  }
  update(nowMs: number): void {
    const t=(nowMs-this.startedAt)/1000,active=t>=0&&t<SMOKE.seconds;
    this.smoke.visible=active;
    this.burst.visible=active&&(t<.55||t>=Math.min(this.wreckStarts[0],this.wreckStarts[1]));
    if(!active)return;
    const blastOpacity=explosionSmokeOpacity(t,SMOKE);
    for(let i=0;i<SMOKE.count;i++){
      const dark=smokeIsDark(i,SMOKE);
      poseExplosionSmoke(this.pose,i,dark,t,this.scale*.8,this.anchor.x,this.anchor.z,SMOKE);
      this.pose.position.y+=this.anchor.y-.4;this.pose.updateMatrix();this.smoke.setMatrixAt(i,this.pose.matrix);
      // Preserve the initial cloud's existing weights and age-driven fade.
      this.smokeAlpha.setX(i,blastOpacity*(dark?Math.max(0,Math.min(1,(SMOKE.seconds*SMOKE.darkFadeEnd-t)/(SMOKE.seconds*.36))):SMOKE.airyWeight));
    }
    // Fresh light/charcoal pairs emerge successively from the landed interiors.
    for(let i=0;i<8;i++){
      const pair=i>>1,source=pair&1,dark=i%2===1,age=t-this.wreckStarts[source]-pair*.20;
      const fade=age<0?0:Math.min(1,age/.12)*Math.max(0,Math.min(1,(1.1-age)/.45))*Math.min(1,(SMOKE.seconds-t)/.25);
      this.smokeAlpha.setX(SMOKE.count+i,fade*(dark?.62:.24));
      const drift=Math.max(0,age),p=this.wreckSources[source];
      this.pose.position.set(p.x+smokeWindX(drift,dark),p.y+this.scale*.07+drift*(dark?.65:.9),p.z-this.scale*.06+Math.sin(pair*2.4)*.12);
      const size=this.scale*(dark?.105:.145)*(1+drift*.65);
      this.pose.scale.set(size*(1+pair*.06),size*(dark?1.05:1.16),size*.9);
      this.pose.rotation.set(pair,i*.7,drift*.12);this.pose.updateMatrix();this.smoke.setMatrixAt(SMOKE.count+i,this.pose.matrix);
    }
    this.smokeAlpha.needsUpdate=true;this.smoke.instanceMatrix.needsUpdate=true;
    if(!this.burst.visible)return;
    for(let i=0;i<10;i++){
      if(t>=.55){
        this.alpha.setX(i,0);this.pose.matrix.makeScale(0,0,0);this.burst.setMatrixAt(i,this.pose.matrix);continue;
      }
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
    // Two small orange flames with warm cores persist after contact, not another blast.
    for(let i=0;i<4;i++){
      const source=i>>1,core=i%2===1,p=this.wreckSources[source],age=t-this.wreckStarts[source];
      const fade=Math.max(0,Math.min(1,age/.12))*Math.min(1,(SMOKE.seconds-t)/.45);
      this.alpha.setX(10+i,fade*(core?.9:.82));
      const flicker=1+.14*Math.sin(age*17+source*2.4)+.06*Math.sin(age*29+source);
      this.pose.position.set(p.x+(core?.02:-.02)*this.scale,p.y+this.scale*(core?.065:.105)*flicker,p.z-this.scale*.08-(core?.025:0));
      this.pose.scale.set(this.scale*(core?.045:.085),this.scale*(core?.105:.18)*flicker,this.scale*(core?.04:.07));
      this.pose.rotation.set(0,0,.12*Math.sin(age*11+source));this.pose.updateMatrix();this.burst.setMatrixAt(10+i,this.pose.matrix);
    }
    this.alpha.needsUpdate=true;this.burst.instanceMatrix.needsUpdate=true;
  }
  reset(): void { this.startedAt=-Infinity;this.smoke.visible=this.burst.visible=false; }
  dispose(): void {
    this.scene.remove(this.smoke,this.burst);this.smoke.dispose();this.burst.dispose();
    this.sphere.dispose();this.smokeGeometry.dispose();this.burstGeometry.dispose();this.smokeMaterial.dispose();this.burstMaterial.dispose();
  }
}
