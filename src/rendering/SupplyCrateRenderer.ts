import * as THREE from 'three';
import type { GameRenderState } from './RenderState';
import type { GrenadeEvent } from '../simulation/grenade';
import { crateFragmentPose } from '../presentation/GrenadeMotion';
import { GOLDEN_GRENADE } from '../art/GoldenGrenade';

export class SupplyCrateRenderer {
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 10, 7);
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#d4a640', roughness: .8 });
  private readonly metal = new THREE.MeshStandardMaterial({ color: '#283533', roughness: .8 });
  private readonly fadingWood = this.wood.clone();
  private readonly fadingMetal = this.metal.clone();
  private readonly pale = new THREE.MeshBasicMaterial({ color: '#eadfbb' });
  private readonly group = new THREE.Group();
  private readonly badge = new THREE.Group();
  private readonly cracks = new THREE.Group();
  private readonly glint = new THREE.Group();
  private readonly interiorMaterial = new THREE.MeshBasicMaterial({ color: '#211d19' });
  private readonly interior = new THREE.Mesh(this.box, this.interiorMaterial);
  private readonly contentsMaterial = new THREE.MeshStandardMaterial({ color: GOLDEN_GRENADE.gold, roughness: .35, metalness: .35 });
  private readonly contents = new THREE.Group();
  private readonly circle = new THREE.CircleGeometry(1, 24);
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: '#302b22', transparent: true, opacity: .22, depthWrite: false });
  private readonly shadow = new THREE.Mesh(this.circle, this.shadowMaterial);
  private readonly pieces: { mesh: THREE.Mesh; rest: THREE.Vector3 }[] = [];
  private opening: { x: number; z: number; atMs: number } | null = null;
  private hitAtMs = -Infinity;
  constructor(private readonly scene: THREE.Scene) {
    this.fadingWood.transparent = this.fadingMetal.transparent = true;
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
    for (let i = 0; i < 4; i++) {
      const crack = new THREE.Mesh(this.box, this.interiorMaterial); crack.scale.set(.09, .38, .035);
      crack.position.set(i<2?-.54:.54, i%2?.19:-.19, -.66); crack.rotation.z = i % 2 ? -.65 : .65;
      this.cracks.add(crack);
    }
    this.interior.name='supply-dark-interior'; this.interior.scale.set(1.1,.88,.65);
    for(const x of [-.3,.3]) {
      const grenade=new THREE.Mesh(this.sphere,this.contentsMaterial); grenade.position.set(x,.08,-.30); grenade.scale.set(.18,.25,.15);
      const cap=new THREE.Mesh(this.box,this.pale); cap.position.set(x,.33,-.30); cap.scale.set(.10,.08,.10); this.contents.add(grenade,cap);
    }
    this.contents.name='supply-golden-contents';
    const plate = new THREE.Mesh(this.circle, this.pale); plate.rotation.y = Math.PI; plate.scale.set(.31, .38, 1); plate.position.z = .035;
    const body = new THREE.Mesh(this.sphere, this.metal); body.scale.set(.19, .26, .12);
    const lever = new THREE.Mesh(this.box, this.pale); lever.scale.set(.1, .13, .1); lever.position.y = .25;
    this.badge.add(plate, body, lever); this.badge.position.set(0, .02, -.56); this.badge.scale.setScalar(1.6);
    for (const y of [-.1, .04]) {
      const groove = new THREE.Mesh(this.box, this.wood); groove.scale.set(.32, .025, .024); groove.position.set(0, y, -.12); this.badge.add(groove);
    }
    const handle = new THREE.Mesh(this.box, this.pale); handle.scale.set(.07, .24, .05); handle.position.set(.15, .17, -.09); handle.rotation.z = .3; this.badge.add(handle);
    for (const vertical of [false, true]) {
      const ray = new THREE.Mesh(this.box, this.pale); ray.scale.set(vertical ? .025 : .22, vertical ? .22 : .025, .018); this.glint.add(ray);
    }
    this.glint.position.set(-.48, .42, -.57);
    this.shadow.name = 'supply-contact-shadow'; this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(1, .65, 1);
    this.group.add(this.badge, this.cracks, this.glint,this.interior,this.contents); scene.add(this.group, this.shadow); this.reset();
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
    this.shadow.visible = !!supply;
    if (!this.group.visible) return;
    const stage = supply?.destruction?.stage ?? 0, age = opening ? nowMs - opening.atMs : 0;
    const jolt = Math.max(0, 1 - (nowMs - this.hitAtMs) / 160);
    this.group.position.set(-(supply?.x ?? this.opening!.x), .9,
      supply?.depth ?? this.opening!.z - (state?.originZ ?? 0));
    this.shadow.position.set(this.group.position.x, .04, this.group.position.z);
    this.glint.visible = !!supply;
    this.glint.scale.setScalar(Math.max(0, Math.sin(nowMs / 650)) ** 8);
    this.group.rotation.set(0, 0, opening ? 0 : Math.sin((nowMs - this.hitAtMs) * .055) * .08 * jolt || 0);
    this.badge.visible = !opening; this.cracks.visible = !opening && stage > 0;
    this.interior.visible = !opening && stage>0; this.contents.visible = !opening && stage===2;
    this.cracks.scale.set(stage===2?1.12:1,stage===2?1.12:1,1);
    this.wood.emissive.set('#ffd898'); this.wood.emissiveIntensity = opening ? 0 : .045 + .035 * Math.sin(nowMs / 550) + jolt * .25;
    let opacity = 1;
    for (const [index, piece] of this.pieces.entries()) {
      const { mesh, rest } = piece; mesh.position.copy(rest); mesh.rotation.set(0, 0, 0);
      if (opening) {
        const p = crateFragmentPose(index, age, .9 + rest.y);
        mesh.position.set(rest.x + p.x, p.y - .9, rest.z + p.z);
        mesh.rotation.set(p.spin, p.spin * .4, p.spin * .65); opacity = p.opacity;
      } else if (index < 8) {
        mesh.position.x += stage * (index % 2 ? .14 : -.14);
        mesh.position.y += stage * (index % 3 - 1) * .045;
        mesh.position.z += stage * (rest.z >= 0 ? .07 : -.07);
        mesh.rotation.z = (index % 2 ? .11 : -.11) * stage;
      } else if (index >= 10 && stage > 0) {
        mesh.rotation.z = (index % 2 ? -1 : 1) * stage * .28;
        mesh.position.x += (rest.x>0?1:-1)*stage*.08;
        mesh.position.z -= stage * .08;
      }
    }
    this.fadingWood.emissive.copy(this.wood.emissive); this.fadingWood.emissiveIntensity = this.wood.emissiveIntensity;
    this.fadingWood.opacity = this.fadingMetal.opacity = opacity;
    for (const { mesh } of this.pieces) mesh.material = mesh.name === 'crate-retaining-strap'
      ? (opacity < 1 ? this.fadingMetal : this.metal) : (opacity < 1 ? this.fadingWood : this.wood);
  }
  preparationMeshes(): THREE.Mesh[] {
    // Keep the opaque and fade programs alive; no shader variant switch at first breakup.
    return [new THREE.Mesh(this.box, this.fadingWood), new THREE.Mesh(this.box, this.fadingMetal)];
  }
  get visible(): boolean { return this.group.visible; }
  reset(): void { this.opening = null; this.hitAtMs = -Infinity; this.group.visible = false; this.shadow.visible = false; }
  dispose(): void { this.scene.remove(this.group, this.shadow); for (const resource of [this.box, this.sphere, this.circle, this.wood, this.metal, this.fadingWood, this.fadingMetal, this.pale, this.shadowMaterial,this.interiorMaterial,this.contentsMaterial]) resource.dispose(); }
}
