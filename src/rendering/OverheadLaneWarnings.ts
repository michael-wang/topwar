import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { ArtilleryShell } from '../simulation/artillery';

// One bounded billboard batch; each lane uses its earliest authoritative impact.
export class OverheadLaneWarnings {
  private readonly geometry: THREE.BufferGeometry;
  private readonly material = new THREE.MeshBasicMaterial({color:'#ff1000',transparent:true,
    depthTest:false,depthWrite:false,toneMapped:false});
  private readonly batch: THREE.InstancedMesh;
  private readonly fillProgress = new THREE.InstancedBufferAttribute(new Float32Array(ARTILLERY_CAPACITY),1);
  private readonly transform = new THREE.Object3D();
  private readonly anchor = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly deadlines = new Float64Array(16);
  private readonly starts = new Float64Array(16);
  private readonly xs = new Float64Array(16);
  private readonly ys = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  count = 0;

  constructor(private readonly scene: THREE.Scene) {
    const triangle = (width: number, top: number, tip: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-width, top-.01); shape.lineTo(width, top); shape.lineTo(0, tip); shape.closePath();
      return shape;
    };
    // A few authored uneven edges, without moving the authoritative bottom tip.
    const rim = new THREE.Shape();
    rim.moveTo(-.40,.35);rim.lineTo(-.025,.345);rim.lineTo(.40,.36);
    rim.lineTo(.225,-.01);rim.lineTo(0,-.42);rim.lineTo(-.215,-.015);rim.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-.375, .325); hole.lineTo(0, -.385); hole.lineTo(.375, .335); hole.closePath();
    rim.holes.push(hole);
    const stem=new THREE.Shape();stem.moveTo(-.075,.06);stem.lineTo(-.10,.29);stem.lineTo(.10,.29);stem.lineTo(.075,.06);stem.closePath();
    const dot=new THREE.Shape();dot.absarc(0,-.11,.075,0,Math.PI*2,false);
    const parts = [new THREE.ShapeGeometry(rim), new THREE.ShapeGeometry(triangle(.375, .335, -.385)),
      new THREE.ShapeGeometry([stem,dot])];
    // Static accents bypass the inward fill mask. Merge all regions into one
    // batch: a thin rim, directional fill and solid black glyph need no extra draw calls.
    const accents = [this.material.color, null, new THREE.Color('#000000')];
    parts.forEach((part, index) => {
      const accent = accents[index], values = new Float32Array(part.attributes.position.count * 4);
      if (accent) for (let v = 0; v < values.length; v += 4) {
        values[v] = accent.r; values[v + 1] = accent.g; values[v + 2] = accent.b; values[v + 3] = 1;
      }
      part.setAttribute('warningAccent', new THREE.Float32BufferAttribute(values, 4));
      const barycentric = new Float32Array(part.attributes.position.count * 3);
      // The body is one triangle. Its interpolated barycentric coordinates
      // measure distance from each edge, independent of billboard scale.
      if (index === 1) for (let v = 0; v < 3; v++) barycentric[v * 3 + v] = 1;
      part.setAttribute('warningBarycentric', new THREE.Float32BufferAttribute(barycentric, 3));
    });
    this.geometry = mergeGeometries(parts)!;
    for (const part of parts) part.dispose();
    this.fillProgress.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('warningFillProgress',this.fillProgress);
    // Fixed shader layout is allocated before idle presentation preparation.
    // Instance progress avoids separate meshes/materials for independent lane clocks.
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute float warningFillProgress;\nattribute vec4 warningAccent;\nattribute vec3 warningBarycentric;\nvarying float vWarningFillProgress;\nvarying vec4 vWarningAccent;\nvarying vec3 vWarningBarycentric;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vWarningFillProgress = warningFillProgress; vWarningAccent = warningAccent; vWarningBarycentric = warningBarycentric;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying float vWarningFillProgress;\nvarying vec4 vWarningAccent;\nvarying vec3 vWarningBarycentric;')
        .replace('#include <color_fragment>',`#include <color_fragment>
          // Shrink a similar transparent triangle toward its centroid.
          // Area filled equals elapsed flight fraction, not a saturation curve.
          float inset = (1.0 - sqrt(1.0 - vWarningFillProgress)) / 3.0;
          float edgeDistance = min(min(vWarningBarycentric.x, vWarningBarycentric.y), vWarningBarycentric.z);
          if (vWarningAccent.a < 0.5 && edgeDistance > inset) discard;
          diffuseColor.rgb = mix(diffuseColor.rgb, vWarningAccent.rgb, vWarningAccent.a);`);
    };
    this.material.customProgramCacheKey=()=> 'overhead-warning-natural-clipping-v6';
    this.batch=new THREE.InstancedMesh(this.geometry,this.material,ARTILLERY_CAPACITY);
    this.batch.name='artillery-lane-danger';this.batch.frustumCulled=false;this.batch.renderOrder=14;
    this.batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(this.batch);
    this.reset();
  }

  update(shells: readonly Readonly<ArtilleryShell>[], nowSeconds: number, camera?: THREE.Camera): void {
    this.deadlines.fill(Infinity);
    for(const shell of shells) {
      if(shell.impactAtSeconds<this.deadlines[shell.targetLane]){
        this.deadlines[shell.targetLane]=shell.impactAtSeconds;
        this.starts[shell.targetLane]=shell.launchedAtSeconds;
        this.xs[shell.targetLane]=-shell.target.x;this.ys[shell.targetLane]=shell.target.y;
        this.zs[shell.targetLane]=shell.target.z;
      }
    }
    let count=0;
    if(camera){camera.updateMatrixWorld();this.transform.quaternion.copy(camera.quaternion);}else this.transform.quaternion.identity();
    this.up.set(0,1,0).applyQuaternion(this.transform.quaternion);
    for(let lane=0;lane<this.deadlines.length;lane++) {
      if(!Number.isFinite(this.deadlines[lane]))continue;
      const remaining=this.deadlines[lane]-nowSeconds;
      const progress=Math.max(0,Math.min(1,(nowSeconds-this.starts[lane])/(this.deadlines[lane]-this.starts[lane])));
      this.fillProgress.setX(count,progress);
      // Last second: smooth pulses grow stronger and faster (2 to 4 beats/s).
      // The final 150ms adds a small emphasis; colour and opacity stay constant.
      const urgency=Math.max(0,Math.min(1,1-remaining));
      const finalEmphasis=Math.max(0,Math.min(1,1-remaining/.15));
      const scale=1+urgency*(.08+.25*urgency)*Math.sin(Math.PI*(2*urgency+urgency*urgency))**2+.10*finalEmphasis**2;
      this.anchor.set(this.xs[lane],this.ys[lane],this.zs[lane]);
      // Billboard-local up keeps the tip at shell.target even under perspective/pulse.
      this.transform.position.copy(this.anchor).addScaledVector(this.up,.42*scale);
      this.transform.scale.setScalar(scale);this.transform.updateMatrix();
      this.batch.setMatrixAt(count++,this.transform.matrix);
    }
    this.count=count;this.batch.count=count;this.batch.visible=count>0;
    this.batch.instanceMatrix.needsUpdate=true;this.fillProgress.needsUpdate=true;
  }
  reset(): void {this.count=0;this.batch.count=0;this.batch.visible=false;}
  dispose(): void {this.scene.remove(this.batch);this.batch.dispose();this.geometry.dispose();this.material.dispose();}
}
