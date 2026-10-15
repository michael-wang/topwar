import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GrenadeExplosion } from './GrenadeExplosion';
import { HeavyAirstrikeExplosion } from './HeavyAirstrikeExplosion';
import { GroundScorchMarks } from './GroundScorchMarks';
import { HEAVY_RAID_LANES, HEAVY_RAID_ROUNDS, supportTankBombZ, type CommanderSupportConfig, type SupportEvent } from '../simulation/commanderSupport';
import type { GameRenderState } from './RenderState';
const BOMBER_LANES = HEAVY_RAID_LANES;
const HEIGHT_OFFSET = [0, .3, .15], HEADING = [.05, 0, -.05], FALLBACK_X = [-4.5, 0, 4.5];
function bomberZ(age: number, c: CommanderSupportConfig, tankZ: number, lane: number): number {
  const depth = lane === 2 ? Math.max(1, tankZ) / 3 : c.heavyRaid!.bandDepthUnits, near = depth / 2;
  if (age <= c.warningSeconds) return -7 + (near + 7) * Math.max(0, age / c.warningSeconds);
  const segment = (age - c.warningSeconds) / c.strikeSpacingSeconds;
  if (segment < 2) return near + depth * segment;
  const far = near + depth * 2;
  const followThrough = c.heavyRaid!.lastStand ? c.heavyRaid!.bandDepthUnits : .5;
  const end = lane === 2 ? tankZ + followThrough * 2 : far + depth * 1.5;
  if (segment <= 5) return lane === 2
    ? segment < 3 ? far + (tankZ - far) * (segment - 2) : tankZ + (segment - 3) * followThrough
    : far + (segment - 2) * depth / 2;
  return end + (age - c.warningSeconds - 5 * c.strikeSpacingSeconds) * 9;
}
function bomberY(age: number, c: CommanderSupportConfig, index: number): number {
  const flight = age - (c.warningSeconds - .6);
  return (flight < 0 ? 24 : 1.35 + flight * .12) + HEIGHT_OFFSET[index];
}
function skyZ(age: number, c: CommanderSupportConfig, tankZ: number, lane: number): number {
  const flight = age - (c.warningSeconds - .6);
  return flight < 0 ? bomberZ(age + .6, c, tankZ, lane) : 5 + flight * 6 + (lane === 2 ? .5 : 0);
}

/** Three shared-geometry four-engine bombers. Saved clocks drive the whole formation. */
export class SupportAirstrikeRenderer {
  readonly planes: THREE.Group[] = [];
  readonly plane: THREE.Group;
  private readonly shadows: THREE.Mesh[] = [];
  private readonly shadowGeometry = new THREE.PlaneGeometry(7, 6).rotateX(-Math.PI / 2);
  private readonly shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { opacity: { value: 0 } },
    vertexShader: 'varying vec2 v; void main(){v=(uv-.5)*vec2(7.,6.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 v; uniform float opacity;
      float box(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
      void main(){
        float d=length(vec2(v.x,max(0.,abs(v.y)-2.1)))-.3;
        d=min(d,box(v-vec2(0.,.1),vec2(3.25,.48)));
        d=min(d,box(v-vec2(0.,2.),vec2(1.25,.26)));
        for(int i=0;i<4;i++){float x=i==0?-2.45:i==1?-1.25:i==2?1.25:2.45;
          d=min(d,box(v-vec2(x,-.65),vec2(.21,.65)));}
        float a=(1.-smoothstep(-.1,.12,d))*opacity;if(a<.001)discard;
        gl_FragColor=vec4(.035,.045,.05,a);
      }`,
  });
  // The low release pass reads above the stylized oversized ground fireballs.
  private readonly metal = new THREE.MeshStandardMaterial({ color: '#3c4856', roughness: .75, transparent: true, depthTest: false, depthWrite: false });
  private readonly detail = new THREE.MeshStandardMaterial({ color: '#99937d', roughness: .8, transparent: true, depthTest: false, depthWrite: false });
  private readonly glass = new THREE.MeshStandardMaterial({ color: '#203744', roughness: .3, transparent: true, depthTest: false, depthWrite: false });
  private readonly geometry: THREE.BufferGeometry;
  private readonly trimGeometry: THREE.BufferGeometry;
  private readonly cockpitGeometry = new THREE.SphereGeometry(1, 8, 6);
  private readonly legacy: GrenadeExplosion;
  private readonly explosions: HeavyAirstrikeExplosion;
  private readonly scorches: GroundScorchMarks;
  private readonly propellers: THREE.Mesh[] = [];
  private readonly bombs: THREE.Group[] = [];
  private readonly propGeometry = new THREE.BoxGeometry(.8, .07, .05);
  private flyoverAt = -Infinity;
  private impactAt = -Infinity;
  private seenImpacts = 0;
  private clockSeconds = -Infinity;
  private clockAtMs = 0;
  constructor(private readonly scene: THREE.Scene) {
    const hull: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [];
    const box = (list: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g);
    };
    const tube = (x: number, y: number, z: number, r: number, length: number) => {
      const g = new THREE.CylinderGeometry(r * .8, r, length, 10); g.rotateX(Math.PI / 2); g.translate(x, y, z); hull.push(g);
    };
    tube(0, 0, 0, .44, 4.8); tube(0, -.04, -2.35, .33, .75);
    box(hull, 0, -.06, .15, 6.6, .17, 1.25);
    box(hull, 0, .14, 2.15, 2.5, .12, .68);
    box(hull, 0, .58, 1.95, .14, 1.1, .85);
    box(trim, 0, .07, .18, 6.4, .055, .12);
    for (const x of [-2.45, -1.25, 1.25, 2.45]) {
      tube(x, -.12, -.65, .23, 1.3); box(trim, x, -.13, -1.32, .43, .43, .09);
    }
    this.geometry = mergeGeometries(hull); this.trimGeometry = mergeGeometries(trim);
    hull.forEach(g => g.dispose()); trim.forEach(g => g.dispose());
    for (let i = 0; i < 3; i++) {
      const root = new THREE.Group(); root.name = `support-heavy-bomber-lane-${BOMBER_LANES[i]}`;
      root.add(new THREE.Mesh(this.geometry, this.metal), new THREE.Mesh(this.trimGeometry, this.detail));
      const cockpit = new THREE.Mesh(this.cockpitGeometry, this.glass); cockpit.position.set(0, .29, -1.65); cockpit.scale.set(.29, .24, .55); root.add(cockpit);
      for (const x of [-2.45, -1.25, 1.25, 2.45]) {
        const prop = new THREE.Mesh(this.propGeometry, this.detail); prop.position.set(x, -.12, -1.39); root.add(prop); this.propellers.push(prop);
      }
      root.traverse(child => { child.renderOrder = 4; });
      root.visible = false; root.scale.setScalar(.85); this.planes.push(root); scene.add(root);
      const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.name = `support-bomber-shadow-${i}`; shadow.visible = false;
      shadow.scale.set(.5, 1, .65); shadow.renderOrder = -1; scene.add(shadow); this.shadows.push(shadow);
    }
    this.plane = this.planes[0]; this.legacy = new GrenadeExplosion(scene, 4, false); this.explosions = new HeavyAirstrikeExplosion(scene);
    this.scorches = new GroundScorchMarks(scene, true);
    for (let i = 0; i < 12; i++) {
      const bomb = new THREE.Group(), body = new THREE.Mesh(this.propGeometry, this.metal), fins = new THREE.Mesh(this.propGeometry, this.detail);
      body.scale.set(.25, 9, 4); fins.scale.set(.65, 1, 9); fins.position.y = .2;
      bomb.add(body, fins); bomb.name = `support-falling-bomb-${i}`; bomb.visible = false; this.bombs.push(bomb); scene.add(bomb);
    }
  }
  present(events: readonly SupportEvent[], now: number): void {
    for (const e of events) {
      if (e.kind === 'supportFlyover') this.flyoverAt = now;
      else { this.impactAt = now; if (!e.heavy) for (const p of e.blasts) this.legacy.present(p.x, p.z, 2.8, now); }
    }
  }
  update(now: number, state: GameRenderState): number {
    const originZ = state.player.z, ended = state.squad.count === 0, frame = state.commanderSupport;
    const a = frame?.state.airstrike, c = frame?.config;
    if (c?.heavyRaid && a?.triggeredAtSeconds != null && frame) {
      if (frame.elapsedSeconds !== this.clockSeconds) { this.clockSeconds = frame.elapsedSeconds; this.clockAtMs = now; }
      const age = frame.elapsedSeconds - a.triggeredAtSeconds + (a.status === 'cancelled' || state.defenseTank?.state.status === 'defeated' ? (now - this.clockAtMs) / 1000 : 0);
      const departure = c.warningSeconds + (HEAVY_RAID_ROUNDS - 1) * c.strikeSpacingSeconds, exit = Math.max(0, age - departure) / 10;
      const reveal = Math.max(0, Math.min(1, (age - (c.warningSeconds - .6)) / .45));
      this.shadowMaterial.uniforms.opacity.value = .2 * Math.min(1, Math.max(0, age / .6))
        * Math.max(0, Math.min(1, (c.warningSeconds + .2 - age) / .8));
      // Aircraft lead their falling bombs by the visible 0.6-second drop.
      const tankZ = a.tankZAtWarning ?? state.defenseTank?.state.z ?? 38;
      for (let i = 0; i < 3; i++) {
        const p = this.planes[i], lane = BOMBER_LANES[i];
        p.visible = !ended && age >= c.warningSeconds - .6 && exit < 1
          && (a.status !== 'cancelled' || frame.elapsedSeconds - a.triggeredAtSeconds >= c.warningSeconds - .6);
        const laneX = -(state.track.lanePositions?.[lane] ?? FALLBACK_X[i]);
        const innerX = laneX - Math.sign(laneX) * .55;
        // The lower release pass is large on screen without reaching the squad.
        // Shared model proportions stay intact; the sea route naturally shrinks it.
        p.scale.setScalar(.5);
        p.position.set(innerX * 1.1,
          bomberY(age, c, i) + Math.sin(age * .8 + i) * .04,
          skyZ(age, c, tankZ, lane) - originZ);
        p.rotation.set(.08 + Math.min(1, age / c.warningSeconds) * .2, Math.PI + HEADING[i], Math.sin(age * .5 + i) * .025);
        const shadow = this.shadows[i];
        shadow.visible = !ended && a.status !== 'cancelled' && age >= 0 && age < c.warningSeconds + .2;
        shadow.position.set(innerX, .018, bomberZ(age + .6, c, tankZ, lane) - originZ);
        shadow.rotation.y = HEADING[i];
      }
      for (const m of [this.metal, this.detail, this.glass]) m.opacity = reveal * Math.min(1, Math.max(0, (1 - exit) / .3));
      for (const p of this.propellers) p.rotation.z = age * 35;
      for (let i = 0; i < 12; i++) {
        const round = i < 9 ? Math.floor(i / 3) : i - 6, lane = i < 9 ? HEAVY_RAID_LANES[i % 3] : 2;
        const impactAge = c.warningSeconds + round * c.strikeSpacingSeconds, t = (age - impactAge + .6) / .6, bomb = this.bombs[i];
        bomb.visible = !ended && a.status !== 'cancelled' && a.strikesCompleted <= round && t >= 0 && t < 1;
        if (!bomb.visible) continue;
        const depth = lane === 2 ? Math.max(1, tankZ) / 3 : c.heavyRaid.bandDepthUnits;
        const z = round < 3 ? (round + .5) * depth : supportTankBombZ(round, state.defenseTank?.state.z ?? tankZ,
          state.defenseTank?.state.hp ?? Infinity, c);
        const startZ = skyZ(impactAge - .6, c, tankZ, lane);
        const laneX = -(state.track.lanePositions?.[lane] ?? 0), planeIndex = lane === 0 ? 0 : lane === 2 ? 1 : 2;
        const startY = bomberY(impactAge - .6, c, planeIndex) - .15;
        const planeX = (laneX - Math.sign(laneX) * .55) * 1.1;
        bomb.position.set(planeX + (laneX - planeX) * t, startY * (1 - t * t), startZ + (z - startZ) * t - originZ);
        bomb.rotation.z = .1 * Math.sin(t * 6);
      }
      const impacts = a.impacts ?? [];
      while (this.seenImpacts < impacts.length) {
        const i = this.seenImpacts++, p = impacts[i], at = now - (frame.elapsedSeconds - p.atSeconds) * 1000;
        this.explosions.present(i, p.x, p.z, at);
        this.scorches.present(p.x, p.z, 4.8, at);
      }
    } else {
      this.scorches.reset();
      this.shadows.forEach(p => p.visible = false);
      this.bombs.forEach(p => p.visible = false);
      const t = (now - this.flyoverAt) / 1100;
      this.planes.forEach((p, i) => p.visible = i === 0 && !ended && t >= 0 && t < 1);
      this.plane.scale.setScalar(.85);
      this.plane.position.set(0, 1.2 + t * 4, -7 + t * 50 - originZ); this.plane.rotation.set(0, Math.PI, -.05);
    }
    this.explosions.update(now, originZ); this.legacy.update(now, originZ); this.scorches.update(now, originZ);
    const age = now - this.impactAt;
    return !ended && age >= 0 && age < 420 ? Math.sin(age / 21) * .14 * (1 - age / 420) : 0;
  }
  reset(): void {
    this.flyoverAt = this.impactAt = -Infinity; this.seenImpacts = 0; this.clockSeconds = -Infinity;
    for (const m of [this.metal, this.detail, this.glass]) m.opacity = 1;
    this.planes.forEach(p => p.visible = false); this.shadows.forEach(p => p.visible = false);
    this.bombs.forEach(p => p.visible = false); this.explosions.reset(); this.legacy.reset(); this.scorches.reset();
  }
  dispose(): void {
    this.explosions.dispose(); this.legacy.dispose(); this.scorches.dispose(); this.scene.remove(...this.planes, ...this.bombs, ...this.shadows);
    for (const g of [this.geometry, this.trimGeometry, this.cockpitGeometry, this.propGeometry, this.shadowGeometry]) g.dispose();
    for (const m of [this.metal, this.detail, this.glass, this.shadowMaterial]) m.dispose();
  }
}
