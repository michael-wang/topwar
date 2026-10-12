import * as THREE from 'three';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { ArtilleryShell } from '../simulation/artillery';

// One bounded billboard batch; each lane uses its earliest authoritative impact.
export class OverheadLaneWarnings {
  private readonly geometry: THREE.ShapeGeometry;
  private readonly material = new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,
    depthTest:false,depthWrite:false,toneMapped:false});
  private readonly batch: THREE.InstancedMesh;
  private readonly opacity = new THREE.InstancedBufferAttribute(new Float32Array(ARTILLERY_CAPACITY),1);
  private readonly transform = new THREE.Object3D();
  private readonly deadlines = new Float64Array(16);
  private readonly starts = new Float64Array(16);
  private readonly early = new THREE.Color('#a75b58');
  private readonly middle = new THREE.Color('#df4132');
  private readonly late = new THREE.Color('#ff2518');
  private readonly tint = new THREE.Color();
  private readonly xs = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  count = 0;

  constructor(private readonly scene: THREE.Scene) {
    const stem=new THREE.Shape();stem.moveTo(-.075,.06);stem.lineTo(-.10,.29);stem.lineTo(.10,.29);stem.lineTo(.075,.06);stem.closePath();
    const dot=new THREE.Shape();dot.absarc(0,-.11,.075,0,Math.PI*2,false);
    this.geometry=new THREE.ShapeGeometry([stem,dot]);
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('warningOpacity',this.opacity);
    // Fixed shader layout is allocated before idle presentation preparation.
    // Instance alpha avoids separate meshes/materials for independent lane clocks.
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute float warningOpacity;\nvarying float vWarningOpacity;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvWarningOpacity = warningOpacity;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying float vWarningOpacity;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vWarningOpacity;');
    };
    this.material.customProgramCacheKey=()=> 'overhead-warning-opacity-v1';
    this.batch=new THREE.InstancedMesh(this.geometry,this.material,ARTILLERY_CAPACITY);
    this.batch.name='artillery-lane-danger';this.batch.frustumCulled=false;this.batch.renderOrder=14;
    this.batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.batch);
    for(let i=0;i<ARTILLERY_CAPACITY;i++)this.batch.setColorAt(i,this.early);
    this.batch.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.reset();
  }

  update(shells: readonly Readonly<ArtilleryShell>[], nowSeconds: number, cameraRotation?: THREE.Quaternion): void {
    this.deadlines.fill(Infinity);
    for(const shell of shells) {
      if(shell.impactAtSeconds<this.deadlines[shell.targetLane]){
        this.deadlines[shell.targetLane]=shell.impactAtSeconds;
        this.starts[shell.targetLane]=shell.launchedAtSeconds;
      }
      this.xs[shell.targetLane]=-shell.target.x;this.zs[shell.targetLane]=shell.target.z;
    }
    let count=0;
    if(cameraRotation)this.transform.quaternion.copy(cameraRotation);else this.transform.quaternion.identity();
    for(let lane=0;lane<this.deadlines.length;lane++) {
      if(!Number.isFinite(this.deadlines[lane]))continue;
      const remaining=this.deadlines[lane]-nowSeconds;
      const progress=Math.max(0,Math.min(1,(nowSeconds-this.starts[lane])/(this.deadlines[lane]-this.starts[lane])));
      const final=remaining<=.15;
      this.tint.copy(progress<.5?this.early:this.middle).lerp(progress<.5?this.middle:this.late,
        progress<.5?progress*2:(progress-.5)*2);
      if(final)this.tint.copy(this.late);
      this.batch.setColorAt(count,this.tint);
      this.opacity.setX(count,final?1:.15+.85*(progress*progress*(3-2*progress)));
      const scale=final ? 1.10+.28*Math.sin(Math.max(0,.15-remaining)*Math.PI*24)**2 : 1;
      // Preserve the accepted lane anchors and vertical band; no player-following offset.
      this.transform.position.set(this.xs[lane]*.72,2.05,this.zs[lane]);
      this.transform.scale.setScalar(scale);this.transform.updateMatrix();
      this.batch.setMatrixAt(count++,this.transform.matrix);
    }
    this.count=count;this.batch.count=count;this.batch.visible=count>0;
    this.batch.instanceColor!.needsUpdate=true;this.batch.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;
  }
  reset(): void {this.count=0;this.batch.count=0;this.batch.visible=false;}
  dispose(): void {this.scene.remove(this.batch);this.batch.dispose();this.geometry.dispose();this.material.dispose();}
}
