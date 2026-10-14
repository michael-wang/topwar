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
  private readonly lean = new THREE.InstancedBufferAttribute(new Float32Array(ARTILLERY_CAPACITY),1);
  private readonly transform = new THREE.Object3D();
  private readonly anchor = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly deadlines = new Float64Array(16);
  private readonly starts = new Float64Array(16);
  private readonly xs = new Float64Array(16);
  private readonly ys = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  private readonly radii = new Float64Array(16);
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
    // Static accents bypass the inward fill mask. Merge all regions into one
    // batch: a thin rim, directional fill and ivory glyph need no extra draw calls.
    const accents = [this.material.color, null, new THREE.Color('#fff3dc')];
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
    this.lean.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('warningFillProgress',this.fillProgress);
    this.geometry.setAttribute('warningLean',this.lean);
    // Fixed shader layout is allocated before idle presentation preparation.
    // Instance progress avoids separate meshes/materials for independent lane clocks.
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute float warningFillProgress;\nattribute float warningLean;\nattribute vec4 warningAccent;\nattribute vec3 warningBarycentric;\nvarying float vWarningFillProgress;\nvarying vec4 vWarningAccent;\nvarying vec3 vWarningBarycentric;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vWarningFillProgress = warningFillProgress; vWarningAccent = warningAccent; vWarningBarycentric = warningBarycentric;
          // Tip stays on the impact. Only the body leans inward at screen edges;
          // the ivory glyph stays upright within the tilted triangle.
          transformed.x += warningLean * (warningAccent.g > 0.5 ? 0.55 : (position.y + 0.42) / 0.78);`);
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
    this.material.customProgramCacheKey=()=> 'overhead-warning-impact-aligned-v4';
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
        this.zs[shell.targetLane]=shell.target.z;this.radii[shell.targetLane]=shell.radius;
      }
    }
    let count=0;
    if(camera){camera.updateMatrixWorld();this.transform.quaternion.copy(camera.quaternion);}else this.transform.quaternion.identity();
    this.up.set(0,1,0).applyQuaternion(this.transform.quaternion);
    this.right.set(1,0,0).applyQuaternion(this.transform.quaternion);
    for(let lane=0;lane<this.deadlines.length;lane++) {
      if(!Number.isFinite(this.deadlines[lane]))continue;
      const remaining=this.deadlines[lane]-nowSeconds;
      const progress=Math.max(0,Math.min(1,(nowSeconds-this.starts[lane])/(this.deadlines[lane]-this.starts[lane])));
      const final=remaining<=.15;
      this.fillProgress.setX(count,progress);
      const scale=final ? 1.10+.28*Math.sin(Math.max(0,.15-remaining)*Math.PI*24)**2 : 1;
      this.anchor.set(this.xs[lane],this.ys[lane],this.zs[lane]);
      let widthScale=scale, lean=0;
      if(camera){
        this.projected.copy(this.anchor).project(camera);
        this.probe.copy(this.anchor).addScaledVector(this.right,.4*scale).project(camera);
        const halfWidth=Math.abs(this.probe.x-this.projected.x);
        this.probe.copy(this.anchor);this.probe.x-=this.radii[lane];this.probe.project(camera);
        const edge=this.probe.x;
        this.probe.copy(this.anchor);this.probe.x+=this.radii[lane];this.probe.project(camera);
        // Keep the body inside BOTH the visible frame and projected damage span.
        // Never clamp or compress the authoritative tip into a different lane.
        const left=Math.max(-.98,Math.min(edge,this.probe.x)),right=Math.min(.98,Math.max(edge,this.probe.x));
        if(halfWidth>0 && right>left){
          const fitted=Math.min(halfWidth,(right-left)/2);
          const center=Math.max(left+fitted,Math.min(right-fitted,this.projected.x));
          widthScale*=fitted/halfWidth;
          lean=(center-this.projected.x)/fitted*.4;
        }
      }
      this.lean.setX(count,lean);
      // Billboard-local up keeps the tip at shell.target even under perspective/pulse.
      this.transform.position.copy(this.anchor).addScaledVector(this.up,.42*scale);
      this.transform.scale.set(widthScale,scale,scale);this.transform.updateMatrix();
      this.batch.setMatrixAt(count++,this.transform.matrix);
    }
    this.count=count;this.batch.count=count;this.batch.visible=count>0;
    this.batch.instanceMatrix.needsUpdate=true;this.fillProgress.needsUpdate=true;this.lean.needsUpdate=true;
  }
  reset(): void {this.count=0;this.batch.count=0;this.batch.visible=false;}
  dispose(): void {this.scene.remove(this.batch);this.batch.dispose();this.geometry.dispose();this.material.dispose();}
}
