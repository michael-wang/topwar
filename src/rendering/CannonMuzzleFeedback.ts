import * as THREE from 'three';

const SMOKE_SLOTS=4, LIGHT_SECONDS=1.5, DARK_SECONDS=1.25;
/** One deduplicated flash per cannon; bounded detached plumes retain sequential shots. */
export class CannonMuzzleFeedback {
  private readonly group = new THREE.Group();
  private readonly cone = new THREE.ConeGeometry(1.0, 2.0, 7);
  private readonly sphere = new THREE.SphereGeometry(1, 8, 6);
  private readonly flameMaterial = new THREE.MeshBasicMaterial({color:'#ffad28',transparent:true,depthWrite:false,toneMapped:false});
  private readonly coreMaterial = new THREE.MeshBasicMaterial({color:'#fff1c7',transparent:true,depthWrite:false,toneMapped:false});
  private readonly flame = new THREE.Mesh(this.cone,this.flameMaterial);
  private readonly core = new THREE.Mesh(this.sphere,this.coreMaterial);
  private readonly pose = new THREE.Object3D();
  private readonly slots: ReturnType<CannonMuzzleFeedback['createSmoke']>[]=[];
  private startedAt = -Infinity;
  private lastLaunch = -Infinity;
  private cursor=0;
  constructor(private readonly scene:THREE.Scene,private readonly mouth:THREE.Object3D,name:string,private readonly scale=1){
    this.group.name=`${name}-muzzle-feedback`;this.group.scale.setScalar(scale);
    this.flame.name=`${name}-muzzle-flame`;this.core.name=`${name}-muzzle-core`;
    this.group.add(this.flame,this.core);mouth.add(this.group);
    for(let i=0;i<SMOKE_SLOTS;i++)this.slots.push(this.createSmoke(name,i));
    this.reset();
  }
  private createSmoke(name:string,index:number){
    // Like GrenadeExplosion, small instanced lobes overlap into an irregular plume.
    const lightMaterial=new THREE.MeshBasicMaterial({color:'#c6cac7',transparent:true,opacity:0,depthWrite:false});
    const darkMaterial=new THREE.MeshBasicMaterial({color:'#303638',transparent:true,opacity:0,depthWrite:false});
    const light=new THREE.InstancedMesh(this.sphere,lightMaterial,3),dark=new THREE.InstancedMesh(this.sphere,darkMaterial,3);
    light.name=`${name}-muzzle-smoke${index?`-${index}`:''}`;dark.name=`${name}-muzzle-dark-smoke${index?`-${index}`:''}`;
    for(const mesh of [light,dark]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}
    this.scene.add(dark,light);
    return {at:-Infinity,needsAnchor:false,origin:new THREE.Vector3(),light,dark,lightMaterial,darkMaterial};
  }
  present(launchSeconds:number,nowMs:number):void{
    if(launchSeconds<=this.lastLaunch)return;
    this.lastLaunch=launchSeconds;this.startedAt=nowMs;
    const slot=this.slots[this.cursor];this.cursor=(this.cursor+1)%SMOKE_SLOTS;
    slot.at=nowMs;slot.needsAnchor=true;
  }
  update(nowMs:number):void{
    const age=(nowMs-this.startedAt)/1000,flash=age>=0&&age<.20;
    this.flame.visible=this.core.visible=flash;
    if(flash){
      // Accepted P4.17 flame/core: dimensions, pulse, color and duration unchanged.
      const t=age/.20,pulse=(1-t)*Math.min(1,.3+t*8);
      this.flame.scale.set(.65+pulse*1.0,.65+pulse*1.0,.65+pulse*1.0);this.flame.position.y=.9;
      this.core.scale.set(.42,.42,.42);this.core.position.y=1.9;
      this.flameMaterial.opacity=1-t;this.coreMaterial.opacity=1-t;
    }
    for(const slot of this.slots){
      const t=(nowMs-slot.at)/1000;
      slot.light.visible=t>=0&&t<LIGHT_SECONDS;slot.dark.visible=t>=0&&t<DARK_SECONDS;
      if(!slot.light.visible&&!slot.dark.visible)continue;
      // Sample after the vehicle pose updates. Following movement is world-space.
      if(slot.needsAnchor){this.mouth.getWorldPosition(slot.origin);slot.needsAnchor=false;}
      const fadeIn=Math.min(1,t/.055),size=this.scale;
      slot.lightMaterial.opacity=.52*fadeIn*Math.pow(Math.max(0,1-t/LIGHT_SECONDS),1.15);
      slot.darkMaterial.opacity=.48*fadeIn*Math.pow(Math.max(0,1-t/DARK_SECONDS),1.35);
      // Camera B faces +Z: render-world -X is screen-right, independent of ship mirroring.
      slot.light.position.set(slot.origin.x-t*2.2*size,slot.origin.y+t*.75*size,slot.origin.z+t*.12*size);
      slot.dark.position.set(slot.origin.x-t*3.4*size,slot.origin.y+t*.45*size,slot.origin.z-t*.08*size);
      for(let i=0;i<3;i++){
        this.pose.rotation.set(i*.7,t*.3+i,0);
        this.pose.position.set((i-1)*(.27+t*.2)*size,(i%2)*(.16+t*.18)*size,(i-1)*.13*size);
        const lightSize=(.31+t*(.43+i*.05))*size;
        this.pose.scale.set(lightSize*(1+i*.14),lightSize*(.72+i*.1),lightSize*.83);
        this.pose.updateMatrix();slot.light.setMatrixAt(i,this.pose.matrix);
        this.pose.position.set((i-1)*(.23+t*.27)*size,(i%2)*(.2+t*.22)*size,-.08*size);
        const darkSize=(.23+t*(.32+i*.04))*size;
        this.pose.scale.set(darkSize*(1+i*.15),darkSize*.8,darkSize*.76);
        this.pose.updateMatrix();slot.dark.setMatrixAt(i,this.pose.matrix);
      }
      slot.light.instanceMatrix.needsUpdate=slot.dark.instanceMatrix.needsUpdate=true;
    }
  }
  reset():void{
    this.startedAt=this.lastLaunch=-Infinity;this.cursor=0;this.flame.visible=this.core.visible=false;
    for(const slot of this.slots){slot.at=-Infinity;slot.needsAnchor=false;slot.light.visible=slot.dark.visible=false;}
  }
  dispose():void{
    this.mouth.remove(this.group);
    for(const slot of this.slots){this.scene.remove(slot.light,slot.dark);slot.light.dispose();slot.dark.dispose();slot.lightMaterial.dispose();slot.darkMaterial.dispose();}
    this.cone.dispose();this.sphere.dispose();this.flameMaterial.dispose();this.coreMaterial.dispose();
  }
}
