import * as THREE from 'three';
import { smokeWindX } from '../../presentation/BattlefieldWind';
import { ENEMY_DEATH_TIMING } from '../../presentation/EnemyDeathTiming';

const SMOKE = { count: 8, puffSeconds: .72, riseSeconds: .30, windStrength: .28,
  darkColor: '#343b3e', lightColor: '#a0a6a7' } as const;
const BURST_COUNT = 10;
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
  private readonly smoke = new THREE.InstancedMesh(this.smokeGeometry, this.smokeMaterial, SMOKE.count);
  private readonly burst = new THREE.InstancedMesh(this.burstGeometry, this.burstMaterial, BURST_COUNT);
  private readonly alpha = new THREE.InstancedBufferAttribute(new Float32Array(BURST_COUNT), 1).setUsage(THREE.DynamicDrawUsage);
  private readonly smokeAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE.count), 1).setUsage(THREE.DynamicDrawUsage);
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
    for (let i=0;i<BURST_COUNT;i++) this.burst.setColorAt(i,color.set(i===0?'#f19332':i===1?'#fff1a1':'#ffe34f'));
    for (let i=0;i<SMOKE.count;i++) this.smoke.setColorAt(i,color.set(i%2===1?SMOKE.darkColor:SMOKE.lightColor));
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
    const t=(nowMs-this.startedAt)/1000,active=t>=0&&t<ENEMY_DEATH_TIMING.giant.totalMs/1000;
    this.smoke.visible=false;
    this.burst.visible=active&&t<.55;
    if(!active)return;
    // Two landed sources, two short-lived light/charcoal pairs each. No standing-pose cloud.
    for(let i=0;i<SMOKE.count;i++){
      const pair=i>>1,source=pair&1,dark=i%2===1,age=t-this.wreckStarts[source]-pair*.12;
      const fade=age<0?0:Math.min(1,age/.10)*Math.max(0,Math.min(1,(SMOKE.puffSeconds-age)/.30));
      this.smokeAlpha.setX(i,fade*(dark?.60:.33));
      if(fade>0)this.smoke.visible=true;
      const rise=Math.max(0,age),drift=Math.max(0,rise-SMOKE.riseSeconds),p=this.wreckSources[source];
      // Vent above the interior so the compact puffs are not buried inside the armor.
      this.pose.position.set(p.x+smokeWindX(drift,dark)*SMOKE.windStrength,p.y+this.scale*.11+rise*(dark?2.0:2.3),p.z-this.scale*.04);
      const size=this.scale*(dark?.135:.18)*(1+rise*.30);
      this.pose.scale.set(size,size*(dark?1.30:1.42),size*.9);
      this.pose.rotation.set(pair,i*.7,rise*.12);this.pose.updateMatrix();this.smoke.setMatrixAt(i,this.pose.matrix);
    }
    this.smokeAlpha.needsUpdate=true;this.smoke.instanceMatrix.needsUpdate=true;
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
    this.alpha.needsUpdate=true;this.burst.instanceMatrix.needsUpdate=true;
  }
  reset(): void { this.startedAt=-Infinity;this.smoke.visible=this.burst.visible=false; }
  dispose(): void {
    this.scene.remove(this.smoke,this.burst);this.smoke.dispose();this.burst.dispose();
    this.sphere.dispose();this.smokeGeometry.dispose();this.burstGeometry.dispose();this.smokeMaterial.dispose();this.burstMaterial.dispose();
  }
}
