import * as THREE from 'three';

/** One reusable burst per physical cannon; a multi-shell salvo shares a deadline. */
export class CannonMuzzleFeedback {
  private readonly group = new THREE.Group();
  private readonly cone = new THREE.ConeGeometry(.85, 1.6, 7);
  private readonly sphere = new THREE.SphereGeometry(1, 8, 6);
  private readonly flameMaterial = new THREE.MeshBasicMaterial({color:'#ffad28',transparent:true,depthWrite:false,toneMapped:false});
  private readonly coreMaterial = new THREE.MeshBasicMaterial({color:'#fff1c7',transparent:true,depthWrite:false,toneMapped:false});
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({color:'#93999b',transparent:true,depthWrite:false});
  private readonly flame = new THREE.Mesh(this.cone,this.flameMaterial);
  private readonly core = new THREE.Mesh(this.sphere,this.coreMaterial);
  private readonly smoke = new THREE.Mesh(this.sphere,this.smokeMaterial);
  private startedAt = -Infinity;
  private lastLaunch = -Infinity;
  constructor(private readonly mouth:THREE.Object3D,name:string,scale=1){
    this.group.name=`${name}-muzzle-feedback`;this.group.scale.setScalar(scale);
    this.flame.name=`${name}-muzzle-flame`;this.core.name=`${name}-muzzle-core`;this.smoke.name=`${name}-muzzle-smoke`;
    this.group.add(this.flame,this.core,this.smoke);mouth.add(this.group);this.reset();
  }
  present(launchSeconds:number,nowMs:number):void{
    if(launchSeconds<=this.lastLaunch)return;
    this.lastLaunch=launchSeconds;this.startedAt=nowMs;
  }
  update(nowMs:number):void{
    const age=(nowMs-this.startedAt)/1000,flash=age>=0&&age<.16;
    this.flame.visible=this.core.visible=flash;this.smoke.visible=age>=0&&age<.65;
    if(flash){
      const t=age/.16,pulse=(1-t)*Math.min(1,.3+t*8);
      this.flame.scale.set(.5+pulse*.65,.55+pulse*.65,.5+pulse*.65);this.flame.position.y=.65;
      this.core.scale.set(.3,.3,.3);this.core.position.y=1.45;
      this.flameMaterial.opacity=1-t;this.coreMaterial.opacity=1-t;
    }
    if(this.smoke.visible){
      const t=age/.65,size=.3+t;
      this.smoke.scale.set(size,size*.8,size);this.smoke.position.set(0,.4+t*1.4,t*.2);
      this.smokeMaterial.opacity=.42*(1-t)*Math.min(1,age/.045);
    }
  }
  reset():void{this.startedAt=this.lastLaunch=-Infinity;this.flame.visible=this.core.visible=this.smoke.visible=false;}
  dispose():void{this.mouth.remove(this.group);this.cone.dispose();this.sphere.dispose();
    this.flameMaterial.dispose();this.coreMaterial.dispose();this.smokeMaterial.dispose();}
}
