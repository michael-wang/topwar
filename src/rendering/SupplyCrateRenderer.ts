import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';
import { crateFragmentPose } from '../presentation/GrenadeMotion';

export class SupplyCrateRenderer {
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#66713b', roughness: 1 });
  private readonly metal = new THREE.MeshStandardMaterial({ color: '#283533', roughness: .8 });
  private readonly pale = new THREE.MeshBasicMaterial({ color: '#eadfbb' });
  private readonly group = new THREE.Group();
  private readonly badge = new THREE.Group();
  private readonly cracks = new THREE.Group();
  private readonly pieces: { mesh: THREE.Mesh; rest: THREE.Vector3 }[] = [];
  private opening: { x: number; z: number; atMs: number } | null = null;
  private hitAtMs = -Infinity;
  constructor(private readonly scene: THREE.Scene) {
    this.group.name = 'grenade-supply';
    const piece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, metal = false) => {
      const mesh = new THREE.Mesh(this.box, metal ? this.metal : this.wood);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
      mesh.name = metal ? 'crate-retaining-strap' : 'crate-wood-panel';
      this.pieces.push({ mesh, rest: mesh.position.clone() }); this.group.add(mesh);
    };
    for (const z of [-.42, .42]) for (let row = 0; row < 3; row++) piece(0, -.3 + row * .3, z, 1.25, .28, .12);
    piece(-.61, 0, 0, .12, .9, .85); piece(.61, 0, 0, .12, .9, .85);
    piece(0, -.48, 0, 1.3, .12, .9); piece(0, .48, 0, 1.3, .12, .9);
    for (const x of [-.4, .4]) {
      piece(x, 0, -.5, .13, 1, .05, true); piece(x, 0, .5, .13, 1, .05, true);
      piece(x, .56, 0, .13, .06, 1, true);
    }
    for (let i = 0; i < 3; i++) {
      const crack = new THREE.Mesh(this.box, this.metal); crack.scale.set(.055, .32, .025);
      crack.position.set((i % 2 ? .34 : .22), -.28 + i * .27, -.515); crack.rotation.z = i % 2 ? -.55 : .55;
      this.cracks.add(crack);
    }
    const body = new THREE.Mesh(this.sphere, this.metal); body.scale.set(.19, .26, .12);
    const lever = new THREE.Mesh(this.box, this.pale); lever.scale.set(.1, .13, .1); lever.position.y = .25;
    this.badge.add(body, lever); this.badge.position.set(0, .02, -.56); this.badge.scale.setScalar(1.35);
    this.group.add(this.badge, this.cracks); scene.add(this.group); this.reset();
  }
  present(events: readonly GrenadeEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.kind === 'grenadeSupplyHit' || event.kind === 'grenadeSupplyDamaged') this.hitAtMs = nowMs;
      if (event.kind === 'grenadeSupplyOpened') this.opening = { x: event.x, z: event.z, atMs: nowMs };
    }
  }
  update(state: GameRenderState['grenade'], nowMs: number): void {
    if (this.opening && nowMs - this.opening.atMs >= 1200) this.opening = null;
    const supply = state?.supply, opening = !supply && this.opening;
    this.group.visible = !!supply || !!opening;
    if (!this.group.visible) return;
    const stage = supply?.destruction?.stage ?? 0, age = opening ? nowMs - opening.atMs : 0;
    const jolt = Math.max(0, 1 - (nowMs - this.hitAtMs) / 160);
    this.group.position.set(-(supply?.x ?? this.opening!.x), .9,
      supply?.depth ?? this.opening!.z - (state?.originZ ?? 0));
    this.group.rotation.set(0, 0, opening ? 0 : Math.sin((nowMs - this.hitAtMs) * .055) * .08 * jolt || 0);
    this.badge.visible = !opening; this.cracks.visible = !opening && stage > 0;
    this.cracks.scale.x = stage === 2 ? 1.4 : 1;
    this.wood.emissive.set('#ffd898'); this.wood.emissiveIntensity = opening ? 0 : jolt * .25;
    let opacity = 1;
    for (const [index, piece] of this.pieces.entries()) {
      const { mesh, rest } = piece; mesh.position.copy(rest); mesh.rotation.set(0, 0, 0);
      if (opening) {
        const p = crateFragmentPose(index, age, .9 + rest.y);
        mesh.position.set(rest.x + p.x, p.y - .9, rest.z + p.z);
        mesh.rotation.set(p.spin, p.spin * .4, p.spin * .65); opacity = p.opacity;
      } else if (index < 8) {
        mesh.position.x += stage * (index % 2 ? .045 : -.045);
        mesh.position.z += stage === 2 ? (rest.z >= 0 ? .07 : -.07) : 0;
        mesh.rotation.z = stage === 2 ? (index % 2 ? .07 : -.07) : 0;
      } else if (index >= 10 && stage > 0) {
        mesh.rotation.z = (index % 2 ? -1 : 1) * stage * .12;
        mesh.position.z -= stage * .04;
      }
    }
    for (const material of [this.wood, this.metal]) { material.transparent = opacity < 1; material.opacity = opacity; }
  }
  get visible(): boolean { return this.group.visible; }
  reset(): void { this.opening = null; this.hitAtMs = -Infinity; this.group.visible = false; }
  dispose(): void { this.scene.remove(this.group); for (const resource of [this.box, this.sphere, this.wood, this.metal, this.pale]) resource.dispose(); }
}
