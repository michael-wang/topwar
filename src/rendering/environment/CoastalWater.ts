import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { CoastalClouds } from './CoastalClouds';
import { COASTAL_SHORE, COASTAL_SHORE_GLSL } from './CoastalShore';

const C = ART.coastalDefense;
// Opaque sea plus one narrow, alpha-blended shore strip; no physical water pass.
const WATER_FRAGMENT = `uniform float time; uniform vec3 aqua,blue,shine,foam,wetSand; varying vec3 coastPosition;
  ${COASTAL_SHORE_GLSL}
  void main(){
    float depth=coastPosition.z;
    float edge=depth-shoreOffset(coastPosition.x);
    vec3 color=mix(aqua,blue,smoothstep(0.,58.,max(depth,0.)));
    float shallows=1.-smoothstep(0.,23.,depth);
    float wash=sin(coastPosition.x*.43+sin(depth*.21)*1.7)*.035*shallows;
    float ripple=pow(.5+.5*sin(depth*1.5+sin(coastPosition.x*.32)*1.4-time*.38),12.);
    float crossed=pow(.5+.5*sin(depth*.79-coastPosition.x*.28+time*.19),18.);
    color=mix(color,shine,clamp(wash+.065*ripple+.025*crossed,0.,.13));
    float alpha=1.;
    #ifdef SHORE_OVERLAY
      color=mix(wetSand,color,smoothstep(-.25,.85,edge));
      float broken=smoothstep(-.28,.35,sin(coastPosition.x*.63+sin(coastPosition.x*.19)*1.6+time*.17));
      float width=.13+.23*(.5+.5*sin(coastPosition.x*.81+time*.11));
      float lap=(1.-smoothstep(width*.35,width,abs(edge)))*broken*.78;
      float retreat=(1.-smoothstep(.055,.20,abs(edge-.90-.13*sin(coastPosition.x*.37+time*.13))))
        *smoothstep(.08,.65,sin(coastPosition.x*1.17-time*.21))*.32;
      float spots=(1.-smoothstep(.05,.20,abs(edge-1.55)))
        *smoothstep(.86,.99,sin(coastPosition.x*1.43+sin(time*.27)))*.26;
      color=mix(color,foam,clamp(lap+retreat+spots,0.,.82));
      // Beach-side coverage exceeds all spatial/tide offsets plus the wet band.
      alpha=smoothstep(-${COASTAL_SHORE.wetWidth.toFixed(1)},-${(COASTAL_SHORE.wetWidth - .8).toFixed(1)},edge)
        *(.72+.28*smoothstep(-2.,-1.,depth))*(1.-smoothstep(6.,${COASTAL_SHORE.seaReach.toFixed(1)},depth));
    #endif
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class CoastalWater {
  readonly group = new THREE.Group();
  private readonly clouds = new CoastalClouds();
  private readonly geometry = new THREE.PlaneGeometry(240, 180).rotateX(-Math.PI / 2);
  private readonly shoreGeometry = new THREE.PlaneGeometry(240, COASTAL_SHORE.beachReach + COASTAL_SHORE.seaReach)
    .rotateX(-Math.PI / 2).translate(0, 0, (COASTAL_SHORE.seaReach - COASTAL_SHORE.beachReach) / 2);
  private readonly skyGeometry = new THREE.PlaneGeometry(420, 120);
  private readonly material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { time: { value: 0 }, foam: { value: new THREE.Color(C.foam) }, aqua: { value: new THREE.Color(C.shallowAqua) },
      blue: { value: new THREE.Color(C.deepSea) }, shine: { value: new THREE.Color(C.waterLight) },
      wetSand: { value: new THREE.Color('#B1B29A') } },
    vertexShader: `varying vec3 coastPosition;
      void main(){ coastPosition=position; coastPosition.z+=90.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: WATER_FRAGMENT,
  });
  private readonly shoreMaterial = new THREE.ShaderMaterial({
    uniforms: this.material.uniforms, defines: { SHORE_OVERLAY: 1 },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec3 coastPosition;
      void main(){ coastPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: WATER_FRAGMENT,
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
    const shore = new THREE.Mesh(this.shoreGeometry, this.shoreMaterial); shore.name = 'coastal-wet-sand-and-surf';
    shore.position.set(0, .018, C.shorelineZ);
    const sky = new THREE.Mesh(this.skyGeometry, this.skyMaterial); sky.name = 'coastal-sky';
    sky.position.set(0, 48, 164); sky.renderOrder = -2;
    this.group.add(sea, shore, sky, this.clouds.mesh);
  }
  update(nowMs: number): void { this.material.uniforms.time.value = nowMs / 1000; this.clouds.update(nowMs); }
  dispose(): void {
    this.clouds.dispose(); this.geometry.dispose(); this.shoreGeometry.dispose(); this.skyGeometry.dispose();
    this.material.dispose(); this.shoreMaterial.dispose(); this.skyMaterial.dispose();
  }
}
