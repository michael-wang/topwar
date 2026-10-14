import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { ArtilleryShell } from '../simulation/artillery';

const WARNING_FORWARD_OFFSET = 1.2;
const WARNING_WIDTH_SCALE = .75;

// One bounded billboard batch; each lane uses its earliest authoritative impact.
export class OverheadLaneWarnings {
  private readonly geometry: THREE.BufferGeometry;
  private readonly material = new THREE.MeshBasicMaterial({color:'#ff1000',transparent:true,
    depthTest:false,depthWrite:false,toneMapped:false});
  private readonly batch: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private readonly deadlines = new Float64Array(16);
  private readonly xs = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  count = 0;

  constructor(private readonly scene: THREE.Scene) {
    // Authored uneven outline; its interior stays open throughout the warning.
    const rim = new THREE.Shape();
    rim.moveTo(-.40,.35);rim.lineTo(-.025,.345);rim.lineTo(.40,.36);
    rim.lineTo(.225,-.01);rim.lineTo(0,-.42);rim.lineTo(-.215,-.015);rim.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-.375, .325); hole.lineTo(0, -.385); hole.lineTo(.375, .335); hole.closePath();
    rim.holes.push(hole);
    const stem=new THREE.Shape();stem.moveTo(-.075,.06);stem.lineTo(-.10,.29);stem.lineTo(.10,.29);stem.lineTo(.075,.06);stem.closePath();
    const dot=new THREE.Shape();dot.absarc(0,-.11,.075,0,Math.PI*2,false);
    const parts = [new THREE.ShapeGeometry(rim), new THREE.ShapeGeometry([stem,dot])];
    this.geometry = mergeGeometries(parts)!;
    this.geometry.scale(WARNING_WIDTH_SCALE,1,1);
    for (const part of parts) part.dispose();
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
        this.xs[shell.targetLane]=-shell.target.x;
        this.zs[shell.targetLane]=shell.target.z;
      }
    }
    let count=0;
    if(camera){camera.updateMatrixWorld();this.transform.quaternion.copy(camera.quaternion);}else this.transform.quaternion.identity();
    for(let lane=0;lane<this.deadlines.length;lane++) {
      if(!Number.isFinite(this.deadlines[lane]))continue;
      const remaining=this.deadlines[lane]-nowSeconds;
      // Last second: smooth pulses grow stronger and faster (2 to 4 beats/s).
      // The final 150ms adds a small emphasis; colour and opacity stay constant.
      const urgency=Math.max(0,Math.min(1,1-remaining));
      const finalEmphasis=Math.max(0,Math.min(1,1-remaining/.15));
      const scale=1+urgency*(.08+.25*urgency)*Math.sin(Math.PI*(2*urgency+urgency*urgency))**2+.10*finalEmphasis**2;
      // All lanes share this rendering-only depth offset; damage stays at shell.target.
      // Keep the original lane X and overhead height, without any edge-specific fitting.
      this.transform.position.set(this.xs[lane],2.05,this.zs[lane]+WARNING_FORWARD_OFFSET);
      this.transform.scale.setScalar(scale);this.transform.updateMatrix();
      this.batch.setMatrixAt(count++,this.transform.matrix);
    }
    this.count=count;this.batch.count=count;this.batch.visible=count>0;
    this.batch.instanceMatrix.needsUpdate=true;
  }
  reset(): void {this.count=0;this.batch.count=0;this.batch.visible=false;}
  dispose(): void {this.scene.remove(this.batch);this.batch.dispose();this.geometry.dispose();this.material.dispose();}
}
