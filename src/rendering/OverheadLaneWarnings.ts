import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { ArtilleryShell } from '../simulation/artillery';

// One bounded billboard batch; each lane uses its earliest authoritative impact.
export class OverheadLaneWarnings {
  private readonly geometry: THREE.BufferGeometry;
  private readonly material = new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,
    depthTest:false,depthWrite:false,toneMapped:false});
  private readonly batch: THREE.InstancedMesh;
  private readonly opacity = new THREE.InstancedBufferAttribute(new Float32Array(ARTILLERY_CAPACITY),1);
  private readonly transform = new THREE.Object3D();
  private readonly deadlines = new Float64Array(16);
  private readonly starts = new Float64Array(16);
  private readonly early = new THREE.Color('#b07c73');
  private readonly middle = new THREE.Color('#eb5635');
  private readonly late = new THREE.Color('#ff1000');
  private readonly tint = new THREE.Color();
  private readonly xs = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  count = 0;

  constructor(private readonly scene: THREE.Scene) {
    const triangle = (width: number, top: number, tip: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-width, top); shape.lineTo(width, top); shape.lineTo(0, tip); shape.closePath();
      return shape;
    };
    const rim = triangle(.40, .36, -.42);
    const hole = new THREE.Path();
    hole.moveTo(-.375, .335); hole.lineTo(0, -.385); hole.lineTo(.375, .335); hole.closePath();
    rim.holes.push(hole);
    const stem=new THREE.Shape();stem.moveTo(-.075,.06);stem.lineTo(-.10,.29);stem.lineTo(.10,.29);stem.lineTo(.075,.06);stem.closePath();
    const dot=new THREE.Shape();dot.absarc(0,-.11,.075,0,Math.PI*2,false);
    const parts = [new THREE.ShapeGeometry(rim), new THREE.ShapeGeometry(triangle(.375, .335, -.385)),
      new THREE.ShapeGeometry([stem,dot])];
    // Static accents bypass the per-lane body tint. Merge all regions into one
    // batch: a thin rim, directional fill and ivory glyph need no extra draw calls.
    const accents = [new THREE.Color('#3b4045'), null, new THREE.Color('#fff3dc')];
    parts.forEach((part, index) => {
      const accent = accents[index], values = new Float32Array(part.attributes.position.count * 4);
      if (accent) for (let v = 0; v < values.length; v += 4) {
        values[v] = accent.r; values[v + 1] = accent.g; values[v + 2] = accent.b; values[v + 3] = 1;
      }
      part.setAttribute('warningAccent', new THREE.Float32BufferAttribute(values, 4));
    });
    this.geometry = mergeGeometries(parts)!;
    for (const part of parts) part.dispose();
    this.opacity.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('warningOpacity',this.opacity);
    // Fixed shader layout is allocated before idle presentation preparation.
    // Instance alpha avoids separate meshes/materials for independent lane clocks.
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute float warningOpacity;\nattribute vec4 warningAccent;\nvarying float vWarningOpacity;\nvarying vec4 vWarningAccent;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvWarningOpacity = warningOpacity;\nvWarningAccent = warningAccent;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying float vWarningOpacity;\nvarying vec4 vWarningAccent;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vWarningAccent.rgb, vWarningAccent.a);\ndiffuseColor.a *= vWarningOpacity;');
    };
    this.material.customProgramCacheKey=()=> 'overhead-warning-directional-v2';
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
