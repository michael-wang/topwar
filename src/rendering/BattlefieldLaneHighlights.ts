import * as THREE from 'three';
import { ART } from '../art/ArtDirection';
import { ARTILLERY_CAPACITY } from '../config/artilleryConfig';
import type { GameRenderState } from './RenderState';

const look = ART.coastalDefense.laneHighlights;

// One ground draw, no textures or per-frame allocations. Shell state owns all danger lifetime.
export class BattlefieldLaneHighlights {
  private readonly geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly dangerCenters = new Float32Array(ARTILLERY_CAPACITY);
  private readonly uniforms = {
    playerX: { value: 0 }, playerZ: { value: 0 }, playerActive: { value: 0 }, spacing: { value: 1 },
    dangerCenters: { value: this.dangerCenters }, dangerCount: { value: 0 },
    playerColor: { value: new THREE.Color(look.playerColor) }, dangerColor: { value: new THREE.Color(look.dangerColor) },
  };
  private readonly material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, uniforms: this.uniforms,
    vertexShader: `varying vec2 ground;
      void main() { vec4 world=modelMatrix*vec4(position,1.); ground=world.xz;
        gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `varying vec2 ground;
      uniform float playerX, playerZ, playerActive, spacing, dangerCount;
      uniform float dangerCenters[${ARTILLERY_CAPACITY}];
      uniform vec3 playerColor, dangerColor;
      float corridor(float center, float width) {
        return 1.-smoothstep(width*.24,width*.5,abs(ground.x-center));
      }
      void main() {
        float z=ground.y-playerZ;
        float distanceFade=smoothstep(${look.startZ},1.,z)*(1.-smoothstep(${look.fadeFromZ}.,${look.endZ}.,z));
        float danger=0.;
        for(int i=0;i<${ARTILLERY_CAPACITY};i++) {
          if(float(i)>=dangerCount) break;
          danger=max(danger,corridor(dangerCenters[i],spacing*${look.dangerWidthFraction}));
        }
        float cyan=corridor(playerX,spacing*${look.playerWidthFraction})*playerActive;
        // Danger removes cyan through the threatened corridor. A short, narrow near-player cue
        // replaces red locally instead of adding blue over red and making a muddy purple stripe.
        float cue=corridor(playerX,spacing*.34)*smoothstep(1.,1.6,z)*(1.-smoothstep(2.5,3.2,z))*playerActive;
        float red=step(.001,danger)*(1.-step(.35,cue));
        float opacity=mix(cyan*${look.playerOpacity},danger*${look.dangerOpacity},red)*distanceFade;
        gl_FragColor=vec4(mix(playerColor,dangerColor,red),opacity);
        #include <colorspace_fragment>
      }`,
  });
  private readonly mesh = new THREE.Mesh(this.geometry, this.material);

  constructor(private readonly scene: THREE.Scene) {
    this.mesh.name = 'battlefield-lane-highlights';
    this.mesh.position.y = .03;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(state: GameRenderState): void {
    const lanes = state.track.lanePositions;
    if (!state.defenseMode || !lanes || lanes.length < 2 || state.squad.count === 0
      || state.defenseTank?.state.status === 'defeated') { this.reset(); return; }
    const spacing = Math.abs(lanes[1] - lanes[0]);
    this.uniforms.spacing.value = spacing;
    this.uniforms.playerX.value = -state.player.x;
    this.uniforms.playerZ.value = state.player.z;
    this.uniforms.playerActive.value = 1;
    let mask = 0, count = 0;
    const shells = state.artillery?.shells;
    if (shells) for (const shell of shells) {
      const lane = shell.targetLane;
      if (lane < 0 || lane >= lanes.length || (mask & (1 << lane))) continue;
      mask |= 1 << lane;
      this.dangerCenters[count++] = -lanes[lane];
    }
    this.uniforms.dangerCount.value = count;
    this.mesh.position.z = state.player.z + (look.startZ + look.endZ) / 2;
    this.mesh.scale.set(state.track.halfWidth * 2 + spacing, 1, look.endZ - look.startZ);
    this.mesh.visible = this.uniforms.playerActive.value > 0 || count > 0;
  }

  reset(): void { this.mesh.visible = false; this.uniforms.dangerCount.value = this.uniforms.playerActive.value = 0; }
  dispose(): void { this.scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}
