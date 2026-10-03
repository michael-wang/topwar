import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';

const C = ART.coastalDefense;
// Two broad, slow ripple bands over a depth color wash. No reflection pass/ocean simulation.
export class CoastalWater {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(240, 180).rotateX(-Math.PI / 2);
  private readonly skyGeometry = new THREE.PlaneGeometry(420, 120);
  private readonly material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { time: { value: 0 }, aqua: { value: new THREE.Color(C.shallowAqua) },
      blue: { value: new THREE.Color(C.deepSea) }, shine: { value: new THREE.Color(C.waterLight) } },
    vertexShader: `varying vec3 coastPosition;
      void main(){ coastPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float time; uniform vec3 aqua,blue,shine; varying vec3 coastPosition;
      void main(){
        float depth=coastPosition.z+90.;
        vec3 color=mix(aqua,blue,smoothstep(0.,58.,depth));
        float shallows=(1.-smoothstep(0.,23.,depth));
        float wash=sin(coastPosition.x*.43+sin(coastPosition.z*.21)*1.7)*.035*shallows;
        float ripple=pow(.5+.5*sin(coastPosition.z*1.5+sin(coastPosition.x*.32)*1.4-time*.38),12.);
        float crossed=pow(.5+.5*sin(coastPosition.z*.79-coastPosition.x*.28+time*.19),18.);
        color=mix(color,shine,clamp(wash+.065*ripple+.025*crossed,0.,.13));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  private readonly skyMaterial = new THREE.ShaderMaterial({
    uniforms: { horizon: { value: new THREE.Color(C.horizon) }, sky: { value: new THREE.Color(C.sky) } },
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 skyUv; void main(){skyUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 skyUv; uniform vec3 horizon,sky; void main(){
      gl_FragColor=vec4(mix(horizon,sky,smoothstep(.05,.36,skyUv.y)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  constructor() {
    this.group.name = 'coastal-water-and-sky';
    const sea = new THREE.Mesh(this.geometry, this.material); sea.name = 'defense-sea';
    sea.position.set(0, -.06, C.shorelineZ + 90);
    const sky = new THREE.Mesh(this.skyGeometry, this.skyMaterial); sky.name = 'coastal-sky';
    sky.position.set(0, 48, 164); sky.renderOrder = -2;
    this.group.add(sea, sky);
  }
  update(nowMs: number): void { this.material.uniforms.time.value = nowMs / 1000; }
  dispose(): void { this.geometry.dispose(); this.skyGeometry.dispose(); this.material.dispose(); this.skyMaterial.dispose(); }
}
