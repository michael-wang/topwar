import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { CoastalClouds } from './CoastalClouds';

const C = ART.coastalDefense;
// Two broad, slow ripple bands over a depth color wash. No reflection pass/ocean simulation.
export class CoastalWater {
  readonly group = new THREE.Group();
  private readonly clouds = new CoastalClouds();
  private readonly geometry = new THREE.PlaneGeometry(240, 180).rotateX(-Math.PI / 2);
  private readonly skyGeometry = new THREE.PlaneGeometry(420, 120);
  private readonly material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { time: { value: 0 }, foam: { value: new THREE.Color(C.foam) }, aqua: { value: new THREE.Color(C.shallowAqua) },
      blue: { value: new THREE.Color(C.deepSea) }, shine: { value: new THREE.Color(C.waterLight) } },
    vertexShader: `varying vec3 coastPosition;
      void main(){ coastPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float time; uniform vec3 aqua,blue,shine,foam; varying vec3 coastPosition;
      void main(){
        float depth=coastPosition.z+90.;
        vec3 color=mix(aqua,blue,smoothstep(0.,58.,depth));
        float shallows=(1.-smoothstep(0.,23.,depth));
        float wash=sin(coastPosition.x*.43+sin(coastPosition.z*.21)*1.7)*.035*shallows;
        float ripple=pow(.5+.5*sin(coastPosition.z*1.5+sin(coastPosition.x*.32)*1.4-time*.38),12.);
        float crossed=pow(.5+.5*sin(coastPosition.z*.79-coastPosition.x*.28+time*.19),18.);
        color=mix(color,shine,clamp(wash+.065*ripple+.025*crossed,0.,.13));
        float tide=.30+.20*sin(time*.48+sin(coastPosition.x*.09)*.7);
        float edge=depth-tide-.10*sin(coastPosition.x*.38-time*.31);
        float lace=.55+.45*sin(coastPosition.x*.72+sin(coastPosition.x*.21)*2.+time*.22);
        float lap=(1.-smoothstep(.12,.48,abs(edge)))*(.30+.45*lace);
        float retreat=(1.-smoothstep(.09,.32,abs(edge-.66)))*(.09+.09*sin(time*.48+1.4));
        color=mix(color,foam,clamp(lap+retreat,0.,.75));
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
    this.group.add(sea, sky, this.clouds.mesh);
  }
  update(nowMs: number): void { this.material.uniforms.time.value = nowMs / 1000; this.clouds.update(nowMs); }
  dispose(): void { this.clouds.dispose(); this.geometry.dispose(); this.skyGeometry.dispose(); this.material.dispose(); this.skyMaterial.dispose(); }
}
