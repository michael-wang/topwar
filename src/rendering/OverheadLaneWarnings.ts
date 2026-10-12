import * as THREE from 'three';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { ArtilleryShell } from '../simulation/artillery';

// Fixed battlefield band, independent of player X. Three pooled batches cover
// at most eight distinct active lanes, including same-lane overlapping shells.
export class OverheadLaneWarnings {
  private readonly badgeGeometry: THREE.ShapeGeometry;
  private readonly glyphGeometry: THREE.ShapeGeometry;
  private readonly ink = new THREE.MeshBasicMaterial({color:'#111b28',depthTest:false,depthWrite:false,toneMapped:false});
  private readonly coral = new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false,depthWrite:false,toneMapped:false});
  private readonly ivory = new THREE.MeshBasicMaterial({color:'#fff3c9',depthTest:false,depthWrite:false,toneMapped:false});
  private readonly batches: readonly THREE.InstancedMesh[];
  private readonly transform = new THREE.Object3D();
  private readonly deadlines = new Float64Array(16);
  private readonly starts = new Float64Array(16);
  private readonly early = new THREE.Color('#b96e57');
  private readonly middle = new THREE.Color('#ef633a');
  private readonly late = new THREE.Color('#ff2518');
  private readonly tint = new THREE.Color();
  private readonly xs = new Float64Array(16);
  private readonly zs = new Float64Array(16);
  count = 0;

  constructor(private readonly scene: THREE.Scene) {
    const badge=new THREE.Shape();badge.moveTo(-.47,.36);badge.lineTo(.47,.36);badge.lineTo(0,-.48);badge.closePath();
    const stem=new THREE.Shape();stem.moveTo(-.075,.06);stem.lineTo(-.10,.29);stem.lineTo(.10,.29);stem.lineTo(.075,.06);stem.closePath();
    const dot=new THREE.Shape();dot.absarc(0,-.11,.075,0,Math.PI*2,false);
    this.badgeGeometry=new THREE.ShapeGeometry(badge);this.glyphGeometry=new THREE.ShapeGeometry([stem,dot]);
    this.batches=[new THREE.InstancedMesh(this.badgeGeometry,this.ink,ARTILLERY_CAPACITY),
      new THREE.InstancedMesh(this.badgeGeometry,this.coral,ARTILLERY_CAPACITY),
      new THREE.InstancedMesh(this.glyphGeometry,this.ivory,ARTILLERY_CAPACITY)];
    this.batches.forEach((mesh,i)=>{mesh.name=['artillery-lane-outline','artillery-lane-danger','artillery-lane-glyph'][i];
      mesh.frustumCulled=false;mesh.renderOrder=12+i;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);});
    // Allocate instance colors before bounded shader preparation, not on first launch.
    for(let i=0;i<ARTILLERY_CAPACITY;i++)this.batches[1].setColorAt(i,this.early);
    this.batches[1].instanceColor!.setUsage(THREE.DynamicDrawUsage);
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
      this.batches[1].setColorAt(count,this.tint);
      const scale=final ? 1.05+.12*Math.sin(Math.max(0,.15-remaining)*Math.PI*24)**2
        : .94+.08*Math.sin(progress*Math.PI*4)**2;
      // Raising a billboard above the squad expands its projected X spacing.
      // Fit the five lane columns inside the portrait frame, including ink edges.
      this.transform.position.set(this.xs[lane]*.72,2.05,this.zs[lane]);
      for(let i=0;i<this.batches.length;i++) {
        this.transform.scale.setScalar(scale*(i===1?.82:1));this.transform.updateMatrix();
        this.batches[i].setMatrixAt(count,this.transform.matrix);
      }
      count++;
    }
    this.count=count;
    this.batches[1].instanceColor!.needsUpdate=true;
    for(const mesh of this.batches){mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;}
  }
  reset(): void {this.count=0;for(const mesh of this.batches){mesh.count=0;mesh.visible=false;}}
  dispose(): void {for(const mesh of this.batches){this.scene.remove(mesh);mesh.dispose();}
    this.badgeGeometry.dispose();this.glyphGeometry.dispose();this.ink.dispose();this.coral.dispose();this.ivory.dispose();}
}
