import * as THREE from 'three';
import { ART } from '../../art/ArtDirection';
import { CoastalClouds } from './CoastalClouds';
import { COASTAL_SHORE, COASTAL_SHORE_GLSL, COASTAL_SURF } from './CoastalShore';

const C = ART.coastalDefense;
// Opaque sea plus one narrow, alpha-blended shore strip; no physical water pass.
const WATER_FRAGMENT = `uniform float time; uniform vec3 aqua,blue,shine,foam,wetSand,clearAqua,middleBlue; varying vec3 coastPosition;
  ${COASTAL_SHORE_GLSL}
  void main(){
    float depth=coastPosition.z;
    float edge=depth-shoreOffset(coastPosition.x);
    vec3 color=mix(clearAqua,aqua,smoothstep(0.,7.,max(edge,0.)));
    color=mix(color,middleBlue,smoothstep(6.,28.,depth));
    color=mix(color,blue,smoothstep(25.,65.,depth));
    float shallows=1.-smoothstep(5.,24.,depth);
    // Three unequal crossing phases imply moving shallow light, not refraction.
    float waveA=sin(coastPosition.x*.68+depth*.82-time*.19);
    float waveB=sin(coastPosition.x*-.53+depth*.61+time*.14);
    float waveC=sin(coastPosition.x*.31-depth*.47+time*.11);
    float caustic=(1.-smoothstep(.10,.36,abs(waveA+.45*waveC)))*(.45+.55*(.5+.5*waveB));
    float ripple=.5+.5*sin(coastPosition.x*.17+depth*.39+waveB*.6-time*.13);
    float crossed=.5+.5*sin(coastPosition.x*-.24+depth*.23+time*.09);
    float glint=smoothstep(.965,1.,waveA)*smoothstep(.975,1.,waveB);
    color=mix(color,shine,shallows*(.085*caustic+.025*glint)+.013*ripple+.009*crossed);
    float alpha=1.;
    #ifdef SHORE_OVERLAY
      color=mix(wetSand,color,smoothstep(-.25,.85,edge));
      float broken=smoothstep(-.28,.35,sin(coastPosition.x*.63+sin(coastPosition.x*.19)*1.6+time*.17));
      float width=.13+.23*(.5+.5*sin(coastPosition.x*.81+time*.11));
      float lap=(1.-smoothstep(width*.35,width,abs(edge)))*broken*.24;
      float phase=fract(time/${COASTAL_SURF.cycleSeconds.toFixed(1)}+.032*sin(coastPosition.x*.11)+.014*sin(coastPosition.x*.39+1.2));
      float other=fract(phase+.5);
      float frontBroken=smoothstep(-.25,.42,sin(coastPosition.x*.63+sin(coastPosition.x*.19)*1.6+phase*2.));
      float otherBroken=smoothstep(-.25,.42,sin(coastPosition.x*.63+sin(coastPosition.x*.19)*1.6+other*2.+.8));
      float incoming=max(surfFront(phase,edge,frontBroken),surfFront(other,edge,otherBroken));
      float drain=max(smoothstep(.62,.72,phase)*(1.-smoothstep(.86,1.,phase)),
        smoothstep(.62,.72,other)*(1.-smoothstep(.86,1.,other)));
      float retreat=(1.-smoothstep(.055,.18,abs(edge-.35-.5*drain)))
        *smoothstep(.08,.65,sin(coastPosition.x*1.17-time*.21))*drain*.25;
      float spots=(1.-smoothstep(.05,.20,abs(edge-1.55)))
        *smoothstep(.86,.99,sin(coastPosition.x*1.43+sin(time*.27)))*.26;
      color=mix(color,foam,clamp(max(lap,incoming)+retreat+spots,0.,.90));
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
      clearAqua: { value: new THREE.Color('#9BDED0') }, middleBlue: { value: new THREE.Color('#389EAF') },
      wetSand: { value: new THREE.Color('#B3AD97') } },
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
