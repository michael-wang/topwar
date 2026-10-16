import * as THREE from 'three';

/** One reusable burst per physical cannon; a multi-shell salvo shares a deadline. */
export class CannonMuzzleFeedback {
  private readonly group = new THREE.Group();
  private readonly cone = new THREE.ConeGeometry(1.0, 2.0, 7);
  private readonly sphere = new THREE.SphereGeometry(1, 8, 6);
  private readonly flameMaterial = new THREE.MeshBasicMaterial({color:'#ffad28',transparent:true,depthWrite:false,toneMapped:false});
  private readonly coreMaterial = new THREE.MeshBasicMaterial({color:'#fff1c7',transparent:true,depthWrite:false,toneMapped:false});
  private readonly smokeMaterial = new THREE.MeshBasicMaterial({color:'#727a7d',transparent:true,depthWrite:false});
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
    const age=(nowMs-this.startedAt)/1000,flash=age>=0&&age<.20;
    this.flame.visible=this.core.visible=flash;this.smoke.visible=age>=0&&age<.95;
    if(flash){
      const t=age/.20,pulse=(1-t)*Math.min(1,.3+t*8);
      this.flame.scale.set(.65+pulse*1.0,.65+pulse*1.0,.65+pulse*1.0);this.flame.position.y=.9;
      this.core.scale.set(.42,.42,.42);this.core.position.y=1.9;
      this.flameMaterial.opacity=1-t;this.coreMaterial.opacity=1-t;
    }
    if(this.smoke.visible){
      const t=age/.95,size=.55+t*1.55;
      this.smoke.scale.set(size,size*.9,size);this.smoke.position.set(0,.5+t*1.8,t*.3);
      this.smokeMaterial.opacity=.82*Math.pow(1-t,.9)*Math.min(1,age/.045);
    }
  }
  reset():void{this.startedAt=this.lastLaunch=-Infinity;this.flame.visible=this.core.visible=this.smoke.visible=false;}
  dispose():void{this.mouth.remove(this.group);this.cone.dispose();this.sphere.dispose();
    this.flameMaterial.dispose();this.coreMaterial.dispose();this.smokeMaterial.dispose();}
}
