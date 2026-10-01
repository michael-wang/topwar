import * as THREE from 'three';
import { ARTILLERY_SITES, ArtilleryScheduler, type ArtilleryLayer } from './ArtilleryScheduler';
import { WarActivityScheduler, SKY_FLAK_STARTED, SHIP_PASS_MS,
  AIRCRAFT_PASS_MS } from './WarActivityScheduler';
import { InfernoSurgeScheduler } from './InfernoSurgeScheduler';

const SPAN_LENGTH = 300;
const JOINT_SPACING = 12;
const JOINT_COUNT = 18;
export const BATTLEFIELD_FOG_NEAR = 76;
export const BATTLEFIELD_FOG_FAR = 108;
export const BATTLEFIELD_FOG_COLOR = '#8eaaae';
const ARTILLERY_FLASH_MS = 90;
const ARTILLERY_GLOW_MS = 400;
const ARTILLERY_SMOKE_MS = 2700;
const SKY_FLAK_SMOKE_MS = 2100;

type ImpactSlot = {
  group: THREE.Group;
  flash: THREE.Sprite;
  glow: THREE.Sprite;
  smoke: THREE.Sprite;
  startedAtMs: number;
  layer: ArtilleryLayer;
};

type InfernoVisual = {
  group: THREE.Group;
  sky: THREE.Sprite;
  column: THREE.Sprite;
  core: THREE.Sprite;
  lowerSmoke: THREE.Sprite;
  upperSmoke: THREE.Sprite;
  size: number;
};

export class BridgeEnvironment {
  getDebugStats(): { smoke: number; infernoSources: number; impactSlots: number;
    activeImpacts: number; flakSlots: number; activeFlak: number;
    aircraft: number; activeAircraft: number; shipSections: number } {
    return { smoke: this.smoke.length, infernoSources: this.infernoSources.length,
      impactSlots: this.impactSlots.length,
      activeImpacts: this.impactSlots.filter((slot) => slot.group.visible).length,
      flakSlots: this.flakSlots.length,
      activeFlak: this.flakSlots.filter((slot) => slot.group.visible).length,
      aircraft: this.aircraft.length,
      activeAircraft: this.aircraft.filter((plane) => plane.visible).length,
      shipSections: this.shipSections.length };
  }
  private readonly group = new THREE.Group();
  private readonly near = new THREE.Group();
  private readonly mid = new THREE.Group();
  private readonly far = new THREE.Group();
  private readonly beachhead = new THREE.Group();
  private readonly inferno = new THREE.Group();
  private readonly shipLayer = new THREE.Group();
  private readonly skyLayer = new THREE.Group();
  private readonly previousBackground: THREE.Scene['background'];
  private readonly previousFog: THREE.Scene['fog'];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly joints: THREE.Mesh[] = [];
  private readonly smoke: { sprite: THREE.Sprite; x: number }[] = [];
  private readonly artillery = new ArtilleryScheduler();
  private readonly activity = new WarActivityScheduler();
  private readonly infernoSurges = new InfernoSurgeScheduler();
  private readonly infernoSources: InfernoVisual[] = [];
  private readonly impactSlots: ImpactSlot[] = [];
  private readonly flakSlots: ImpactSlot[] = [];
  private readonly burningCores: { mesh: THREE.Mesh; scale: number }[] = [];
  private readonly shipMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly shipSections: { group: THREE.Group; x: number; halfWidth: number }[] = [];
  private readonly aircraftMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly ship = new THREE.Group();
  private readonly aircraft: THREE.Group[] = [];
  private smokeTexture: THREE.DataTexture | null = null;
  private readonly deck: THREE.Mesh;
  private readonly shoulders: THREE.Mesh[] = [];
  private readonly barriers: THREE.Mesh[] = [];
  private readonly water: THREE.Mesh;
  private readonly defenseBeach = new THREE.Group();

  constructor(private readonly scene: THREE.Scene) {
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    scene.background = new THREE.Color(BATTLEFIELD_FOG_COLOR);
    scene.fog = new THREE.Fog(BATTLEFIELD_FOG_COLOR,
      BATTLEFIELD_FOG_NEAR, BATTLEFIELD_FOG_FAR);
    this.near.name = 'battlefield-near';
    this.mid.name = 'battlefield-mid';
    this.far.name = 'battlefield-far';
    this.beachhead.name = 'enemy-beachhead-horizon';
    this.inferno.name = 'battlefield-deep-inferno';
    this.shipLayer.name = 'battlefield-water-traffic';
    this.skyLayer.name = 'battlefield-sky-activity';
    const deckMaterial = this.material('#8b9291');
    const shoulderMaterial = this.material('#707b7d');
    const parapetMaterial = this.material('#59676b');
    const seamMaterial = this.material('#667073');
    const waterMaterial = this.material('#54747d');
    this.water = this.mesh(new THREE.PlaneGeometry(240, SPAN_LENGTH), waterMaterial,
      'bridge-ocean');
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -.5;
    this.group.add(this.water);
    this.deck = this.mesh(new THREE.PlaneGeometry(1, SPAN_LENGTH), deckMaterial,
      'bridge-deck');
    this.deck.rotation.x = -Math.PI / 2;
    this.group.add(this.deck);
    for (const side of [-1, 1]) {
      const shoulder = this.mesh(new THREE.PlaneGeometry(1, SPAN_LENGTH),
        shoulderMaterial, `bridge-shoulder-${side}`);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.y = .012;
      this.shoulders.push(shoulder);
      this.group.add(shoulder);
      const barrier = this.mesh(new THREE.BoxGeometry(.24, .3, SPAN_LENGTH),
        parapetMaterial, `bridge-barrier-${side}`);
      barrier.position.y = .13;
      this.barriers.push(barrier);
      this.group.add(barrier);
    }
    const jointGeometry = new THREE.PlaneGeometry(1, .055);
    this.geometries.push(jointGeometry);
    for (let i = 0; i < JOINT_COUNT; i++) {
      const joint = new THREE.Mesh(jointGeometry, seamMaterial);
      joint.name = 'bridge-expansion-joint';
      joint.rotation.x = -Math.PI / 2;
      joint.position.y = .018;
      this.joints.push(joint);
      this.scene.add(joint);
    }
    const highlight = this.material('#729098', true, .2);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const band = this.mesh(new THREE.PlaneGeometry(15 + i * 8, .13), highlight,
          'ocean-highlight');
        band.rotation.x = -Math.PI / 2;
        band.position.set(side * (13 + i * 21), -.48, 8 + i * 24);
        this.group.add(band);
      }
    }
    this.buildBattlefield();
    this.buildBeachhead();
    this.buildInferno();
    this.buildArtillery();
    this.buildActivity();
    const sand = this.mesh(new THREE.PlaneGeometry(150, 100), this.material('#c9ad7c'), 'defense-sand');
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, .005, 3);
    const sea = this.mesh(new THREE.PlaneGeometry(240, 180), this.material('#547e84'), 'defense-sea');
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -.06, 143);
    this.defenseBeach.add(sand, sea);
    const foamMaterial = this.material('#bac7b3', true, .4);
    const duneMaterial = this.material('#b79b6c');
    for (let patch = 0; patch < 20; patch++) {
      const foam = this.mesh(new THREE.PlaneGeometry(7, .75), foamMaterial, 'shoreline-foam');
      foam.rotation.x = -Math.PI / 2;
      foam.position.set((patch - 9.5) * 7, .02, 52.8 + Math.sin(patch * 1.7) * .65);
      this.defenseBeach.add(foam);
      if (patch % 3 === 0) {
        const dune = this.mesh(new THREE.SphereGeometry(1, 8, 5), duneMaterial, 'beach-dune');
        dune.position.set((patch % 2 ? 1 : -1) * (9 + patch), -.2, 10 + patch * 2);
        dune.scale.set(4, .55, 6);
        this.defenseBeach.add(dune);
      }
    }
    this.defenseBeach.name = 'stationary-defense-beach';
    this.defenseBeach.visible = false;
    this.scene.add(this.defenseBeach);
    this.scene.add(this.group, this.near, this.mid, this.far, this.beachhead, this.inferno,
      this.shipLayer, this.skyLayer);
    this.update(0, 3.2, 0);
  }

  update(playerZ: number, trackHalfWidth: number, nowMs: number, defenseMode = false): void {
    this.defenseBeach.visible = defenseMode;
    this.defenseBeach.position.z = playerZ;
    this.group.visible = !defenseMode;
    for (const joint of this.joints) joint.visible = !defenseMode;
    const bridgeHalfWidth = Math.max(trackHalfWidth + 1, 4);
    this.group.position.z = playerZ + 55;
    this.deck.scale.x = bridgeHalfWidth * 2;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.shoulders[i].position.x = side * (bridgeHalfWidth - .44);
      this.barriers[i].position.x = side * (bridgeHalfWidth - .12);
    }
    const firstJoint = Math.floor(playerZ / JOINT_SPACING) * JOINT_SPACING - 48;
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i];
      joint.position.z = firstJoint + i * JOINT_SPACING;
      joint.scale.x = bridgeHalfWidth * 2 - .5;
    }
    // Bounded progress offsets keep the vista ahead while nearby wreckage shifts most.
    this.near.position.set(Math.sin(playerZ * .018) * 1.4, 0,
      playerZ + 52 + Math.sin(playerZ * .025) * 3);
    this.mid.position.set(Math.sin(playerZ * .013) * .55, 0,
      playerZ + 76 + Math.sin(playerZ * .014));
    this.far.position.set(Math.sin(playerZ * .008) * .1, 0,
      playerZ + 100 + Math.sin(playerZ * .009) * .25);
    this.beachhead.position.set(Math.sin(playerZ * .003) * .02, 0, playerZ + 125);
    this.inferno.position.set(Math.sin(playerZ * .002) * .01, 0, playerZ + 142);
    this.shipLayer.position.z = playerZ;
    this.skyLayer.position.z = playerZ + 125;
    if (defenseMode) {
      // Scenery is fixed relative to the defense line; internal progression never
      // scrolls tracks, barricades or the horizon past the standing defenders.
      this.near.position.set(0, 0, playerZ + 52);
      this.mid.position.set(0, 0, playerZ + 76);
      this.far.position.set(0, 0, playerZ + 100);
      this.shipLayer.position.z = playerZ + 60;
    }
    for (let i = 0; i < this.smoke.length; i++) {
      this.smoke[i].sprite.position.x = this.smoke[i].x
        + Math.sin(nowMs * .00015 + i * 1.7) * .16;
    }
    for (let index = 0; index < this.burningCores.length; index++) {
      const core = this.burningCores[index];
      core.mesh.scale.y = core.scale * (1 + Math.sin(nowMs * .006 + index * 2) * .1);
    }
    this.updateArtillery(nowMs);
    this.updateActivity(nowMs, bridgeHalfWidth);
    this.updateInferno(nowMs);
  }

  dispose(): void {
    this.scene.remove(this.defenseBeach);
    this.scene.remove(this.group, this.near, this.mid, this.far, this.beachhead, this.inferno,
      this.shipLayer, this.skyLayer, ...this.joints);
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.smokeTexture?.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private buildBattlefield(): void {
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const glowGeometry = new THREE.SphereGeometry(1, 8, 6);
    const flameGeometry = new THREE.ConeGeometry(.42, 1.15, 5);
    this.geometries.push(blockGeometry, glowGeometry, flameGeometry);
    const nearMaterial = this.material('#424e54');
    const nearAccent = this.material('#566267');
    const midMaterial = this.material('#66767a');
    const midAccent = this.material('#78888b');
    const farMaterial = this.material('#6d8b91');
    this.smokeTexture = this.createSmokeTexture();
    const nearSmoke = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#485459', transparent: true, opacity: .47, depthWrite: false });
    const midSmoke = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#647176', transparent: true, opacity: .42, depthWrite: false });
    const farSmoke = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#a4b9bb', transparent: true, opacity: .22, depthWrite: false });
    const lowHaze = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: BATTLEFIELD_FOG_COLOR, transparent: true, opacity: .34, depthWrite: false });
    this.materials.push(nearSmoke, midSmoke, farSmoke, lowHaze);
    const wreckMaterial = this.material('#2b3335');
    const glowMaterial = new THREE.MeshBasicMaterial({ color: '#a46239',
      transparent: true, opacity: .2, depthWrite: false });
    const flameMaterial = new THREE.MeshBasicMaterial({ color: '#bd7947',
      transparent: true, opacity: .66, depthWrite: false });
    const fireSmokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#283136', transparent: true, opacity: .55, depthWrite: false });
    this.materials.push(glowMaterial, flameMaterial, fireSmokeMaterial);

    const ruin = (layer: THREE.Group, x: number, z: number, width: number,
      height: number, material: THREE.Material, tilt = 0): void => {
      const mesh = new THREE.Mesh(blockGeometry, material);
      mesh.name = 'battlefield-ruin';
      mesh.scale.set(width, height, 1.6);
      mesh.position.set(x, height / 2 - .45, z);
      mesh.rotation.z = tilt;
      layer.add(mesh);
    };
    const smoke = (layer: THREE.Group, material: THREE.SpriteMaterial,
      x: number, y: number, z: number, width: number, height: number,
      name = 'battlefield-smoke'): void => {
      const sprite = new THREE.Sprite(material);
      sprite.name = name;
      sprite.position.set(x, y, z);
      sprite.scale.set(width, height, 1);
      this.smoke.push({ sprite, x });
      layer.add(sprite);
    };
    const fire = (layer: THREE.Group, x: number, z: number, options: {
      wreckWidth: number; flameScale: number; smokeWidth: number;
      smokeHeight: number; smokeLean: number; slabTilt: number;
    }): void => {
      const site = new THREE.Group();
      site.name = 'battlefield-burning-site';
      site.position.set(x, 0, z);
      const wreck = new THREE.Mesh(blockGeometry, wreckMaterial);
      wreck.name = 'burning-wreck-base';
      wreck.position.set(0, .22, 0);
      wreck.scale.set(options.wreckWidth, .45, 1.3);
      wreck.rotation.y = options.slabTilt * -.7;
      const slab = new THREE.Mesh(blockGeometry, wreckMaterial);
      slab.name = 'burning-wreck-slab';
      slab.position.set(-.55, .66, .2);
      slab.scale.set(.85, 1.1, .3);
      slab.rotation.z = options.slabTilt;
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.name = 'battlefield-fire-glow';
      glow.position.set(.25, .45, 0);
      glow.scale.set(.68 * options.flameScale, .28, .48);
      const core = new THREE.Mesh(flameGeometry, flameMaterial);
      core.name = 'burning-fire-core';
      core.position.set(.3, .95, 0);
      core.scale.setScalar(options.flameScale);
      this.burningCores.push({ mesh: core, scale: options.flameScale });
      site.add(wreck, slab, glow, core);
      for (let index = 0; index < 2; index++) {
        const puff = new THREE.Sprite(fireSmokeMaterial);
        puff.name = 'burning-black-smoke';
        puff.position.set(index * options.smokeLean, 2 + index * options.smokeHeight * .42, 0);
        puff.scale.set(options.smokeWidth * (1 + index * .15),
          options.smokeHeight * (1 + index * .1), 1);
        site.add(puff);
      }
      layer.add(site);
    };

    // Large low wreckage frames the bridge without entering the combat lane.
    ruin(this.near, -15.1, -7, 7.8, 3.7, nearMaterial, -.12);
    ruin(this.near, -12.8, 2, 2.5, 5.1, nearAccent, .16);
    ruin(this.near, 15.4, -6, 6.4, 2.7, nearMaterial, .09);
    ruin(this.near, 12.9, 3, .9, 4.7, nearAccent, -.34);
    smoke(this.near, nearSmoke, 15.8, 3.1, -5.8, 5.9, 6.7);
    smoke(this.near, nearSmoke, 16.5, 5.3, -5.6, 7.3, 8);

    // The active destruction sits deeper, with fire anchored to ruined structures.
    ruin(this.mid, -11.1, -4, 4.5, 5.4, midMaterial, -.09);
    ruin(this.mid, -15.8, 3, 2.2, 6.5, midAccent, .13);
    ruin(this.mid, 12.3, -2, 4.2, 3.4, midMaterial, .08);
    ruin(this.mid, 18.6, 4, 4.8, 5.2, midAccent, -.12);
    fire(this.mid, -14, -7, { wreckWidth: 3.2, flameScale: .72,
      smokeWidth: 2.3, smokeHeight: 5.1, smokeLean: -.5, slabTilt: -.43 });
    fire(this.mid, 8.8, 3.2, { wreckWidth: 1.65, flameScale: 1.04,
      smokeWidth: 4.1, smokeHeight: 2.7, smokeLean: .75, slabTilt: .2 });
    smoke(this.mid, midSmoke, -11.2, 3.2, -4, 4.3, 5.2);
    smoke(this.mid, midSmoke, -10.6, 5.4, -4.1, 6.1, 7.2);
    smoke(this.mid, midSmoke, -12.1, 7.8, -4, 7.4, 8.3);
    smoke(this.mid, midSmoke, 12.4, 4.2, -2, 4.7, 5.9);
    smoke(this.mid, midSmoke, 13.3, 6.5, -1.9, 6.3, 7.6);

    // Small skyline blocks and a broken crane nearly merge into the far haze.
    ruin(this.far, -22, -5, 2.7, 2.1, farMaterial, .04);
    ruin(this.far, -16.8, -3, 1.9, 2.8, farMaterial, -.06);
    ruin(this.far, -12.6, -4, 2.3, 1.7, farMaterial, .03);
    ruin(this.far, 13.4, -4, 1.8, 2.5, farMaterial, -.04);
    ruin(this.far, 18.1, -3, 2.6, 1.9, farMaterial, .07);
    ruin(this.far, 24.3, -5, 2.4, 2.8, farMaterial, -.06);
    ruin(this.far, 22.1, -4, .28, 4.2, farMaterial);
    const craneArm = new THREE.Mesh(blockGeometry, farMaterial);
    craneArm.name = 'battlefield-crane';
    craneArm.scale.set(3.8, .18, .35);
    craneArm.position.set(20.4, 3.7, -4);
    craneArm.rotation.z = -.08;
    this.far.add(craneArm);
    smoke(this.far, farSmoke, 24.7, 4.4, -5, 5.1, 6.3);
    smoke(this.far, farSmoke, 25.3, 6.4, -5, 6.5, 7.2);
    smoke(this.far, lowHaze, -1.8, 2.4, -12, 20, 8, 'battlefield-low-haze');
    smoke(this.far, lowHaze, 2.8, 2.8, -9, 18, 9, 'battlefield-low-haze');
  }

  private buildBeachhead(): void {
    const block = new THREE.BoxGeometry(1, 1, 1);
    this.geometries.push(block);
    const steel = new THREE.MeshBasicMaterial({ color: '#526a70', transparent: true,
      opacity: .34, depthWrite: false, fog: false });
    const distance = new THREE.MeshBasicMaterial({ color: '#647c81', transparent: true,
      opacity: .25, depthWrite: false, fog: false });
    this.materials.push(steel, distance);
    const part = (parent: THREE.Group, name: string, x: number, y: number,
      z: number, width: number, height: number, depth: number,
      material: THREE.Material = steel, tilt = 0): void => {
      const mesh = new THREE.Mesh(block, material);
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      mesh.rotation.z = tilt;
      parent.add(mesh);
    };
    const crane = (x: number, z: number, height: number, arm: number,
      tilt: number): void => {
      const group = new THREE.Group();
      group.name = 'beachhead-crane';
      part(group, 'crane-leg', -2.1, height / 2, z, .6, height, .6, steel, tilt);
      part(group, 'crane-leg', 2.1, height / 2, z, .6, height, .6, steel, tilt);
      part(group, 'crane-crossbeam', 0, height - 2, z, 5.2, .42, .6);
      part(group, 'crane-boom', arm * .21, height + 1, z, arm, .5, .7, steel, tilt);
      part(group, 'crane-cable', arm * .38, height - 2.5, z, .13, 6, .12, distance);
      group.position.x = x;
      this.beachhead.add(group);
    };
    crane(-18.5, -2.8, 22, 13, -.075);
    crane(16, -3.6, 19, 11, .065);
    crane(28, -5, 15, 8, -.1);
    const tower = new THREE.Group();
    tower.name = 'beachhead-control-tower';
    part(tower, 'tower-shaft', 0, 8, -4, 2.1, 16, 2, distance, -.04);
    part(tower, 'tower-cab', 0, 17, -4, 5.5, 2.6, 2.3);
    part(tower, 'tower-broken-roof', -.6, 18.8, -4, 4.4, .3, 2.3, steel, -.19);
    tower.position.x = 7.5;
    this.beachhead.add(tower);
    part(this.beachhead, 'beachhead-broken-mast', -8.5, 11, -4,
      .22, 20, .24, steel, .17);
    part(this.beachhead, 'beachhead-terminal', -13.5, 2.1, -5,
      7.5, 4.2, 3, distance);
    part(this.beachhead, 'beachhead-terminal', 13.2, 1.6, -6,
      5.8, 3.2, 3, distance);
    const transport = (x: number, z: number, width: number): void => {
      const group = new THREE.Group();
      group.name = 'beachhead-transport';
      part(group, 'ship-hull', 0, 1.4, z, width, 2.8, 3, distance);
      part(group, 'ship-superstructure', -width * .16, 4.8, z,
        width * .38, 4.2, 2.4);
      part(group, 'ship-stack', -width * .22, 8.2, z,
        1.2, 3.4, 1.1, steel);
      part(group, 'ship-mast', width * .16, 7.2, z,
        .18, 8, .18, distance, -.08);
      group.position.x = x;
      this.beachhead.add(group);
    };
    transport(-32, -7, 15);
    transport(34, -8, 12);
    if (this.smokeTexture) {
      const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#72868a', transparent: true, opacity: .2, depthWrite: false, fog: false });
      this.materials.push(smokeMaterial);
      for (const [x, y, z, scale] of [[-20, 18, -9, 14], [22, 15, -10, 12]]) {
        const smoke = new THREE.Sprite(smokeMaterial);
        smoke.name = 'beachhead-smoke';
        smoke.position.set(x, y, z);
        smoke.scale.set(scale, scale * 1.4, 1);
        this.beachhead.add(smoke);
      }
    }
  }

  private buildInferno(): void {
    const sourcePositions = [
      { x: -22, z: -4, size: 1.12 },
      { x: 17, z: 1, size: .9 },
      { x: 34, z: 5, size: .68 },
    ];
    for (let index = 0; index < sourcePositions.length; index++) {
      const { x, z, size } = sourcePositions[index];
      const group = new THREE.Group();
      group.name = 'inferno-source';
      group.position.set(x, 0, z);
      const sprite = (name: string, color: string, additive: boolean,
        xOffset: number, y: number, depth: number): THREE.Sprite => {
        const material = new THREE.SpriteMaterial({ map: this.smokeTexture,
          color, transparent: true, opacity: 0, depthWrite: false, fog: false,
          blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
        this.materials.push(material);
        const result = new THREE.Sprite(material);
        result.name = name;
        result.position.set(xOffset, y, depth);
        group.add(result);
        return result;
      };
      const sky = sprite('inferno-sky-glow', '#ad7058', true, 0, 16, 8);
      const column = sprite('inferno-column-glow', '#b8744e', true,
        index === 2 ? -.7 : .4, 7.5, 5);
      const core = sprite('inferno-fire-core', '#c78356', true, 0, 2.8, 3);
      const lowerSmoke = sprite('inferno-smoke-lower', '#343d40', false,
        index === 1 ? -1 : .8, 11, 1);
      const upperSmoke = sprite('inferno-smoke-upper', '#4d595d', false,
        index === 1 ? 1.4 : -1, 21, 0);
      this.inferno.add(group);
      this.infernoSources.push({ group, sky, column, core, lowerSmoke, upperSmoke, size });
    }
  }

  private updateInferno(nowMs: number): void {
    const states = this.infernoSurges.update(nowMs);
    for (let index = 0; index < this.infernoSources.length; index++) {
      const visual = this.infernoSources[index];
      const surge = states[index].strength;
      const flicker = 1 + Math.sin(nowMs * .0034 + index * 2.3) * .045;
      const size = visual.size;
      (visual.sky.material as THREE.SpriteMaterial).opacity = (.045 + surge * .09) * flicker;
      (visual.column.material as THREE.SpriteMaterial).opacity = (.07 + surge * .15) * flicker;
      (visual.core.material as THREE.SpriteMaterial).opacity = (.11 + surge * .17) * flicker;
      (visual.lowerSmoke.material as THREE.SpriteMaterial).opacity =
        .12 + surge * .085 * states[index].smokeScale;
      (visual.upperSmoke.material as THREE.SpriteMaterial).opacity =
        .085 + surge * .045 * states[index].smokeScale;
      visual.sky.scale.set(24 * size * (1 + surge * .22 * states[index].widthScale),
        29 * size * (1 + surge * .2 * states[index].heightScale), 1);
      visual.column.scale.set(9 * size * (1 + surge * .32 * states[index].widthScale),
        15 * size * (1 + surge * .55 * states[index].heightScale), 1);
      visual.core.scale.set(6 * size * (1 + surge * .2),
        5 * size * (1 + surge * .35 * states[index].heightScale), 1);
      visual.lowerSmoke.scale.set(10 * size * (1 + surge * .18),
        13 * size * (1 + surge * .27 * states[index].smokeScale), 1);
      visual.upperSmoke.scale.set(15 * size * (1 + surge * .13),
        18 * size * (1 + surge * .2 * states[index].smokeScale), 1);
      visual.lowerSmoke.position.y = 11 + surge * 1.8 * states[index].heightScale;
      visual.upperSmoke.position.y = 21 + surge * 2.7 * states[index].heightScale;
    }
  }

  private createSmokeTexture(): THREE.DataTexture {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x + .5 - size / 2) / (size / 2);
        const ny = (y + .5 - size / 2) / (size / 2);
        const distance = Math.sqrt(nx * nx + ny * ny);
        const variation = .86 + .14 * Math.sin(x * 1.9 + y * 2.7);
        const alpha = Math.max(0, 1 - distance) ** 1.6 * variation;
        const offset = (y * size + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = Math.round(alpha * 255);
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private buildArtillery(): void {
    for (let index = 0; index < 5; index++) {
      const flashMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#fff1b1', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const glowMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#dd7437', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#4c585d', transparent: true, opacity: 0, depthWrite: false });
      this.materials.push(flashMaterial, glowMaterial, smokeMaterial);
      const group = new THREE.Group();
      group.name = 'battlefield-artillery-slot';
      const flash = new THREE.Sprite(flashMaterial);
      flash.name = 'battlefield-artillery-flash';
      const glow = new THREE.Sprite(glowMaterial);
      glow.name = 'battlefield-artillery-glow';
      const smoke = new THREE.Sprite(smokeMaterial);
      smoke.name = 'battlefield-artillery-smoke';
      group.add(flash, glow, smoke);
      group.visible = false;
      this.mid.add(group);
      this.impactSlots.push({ group, flash, glow, smoke,
        startedAtMs: -Infinity, layer: 'mid' });
    }
  }

  private buildActivity(): void {
    const block = new THREE.BoxGeometry(1, 1, 1);
    this.geometries.push(block);
    const hull = this.material('#303b40', true, 0);
    const fittings = this.material('#39474b', true, 0);
    this.shipMaterials.push(hull, fittings);
    const part = (parent: THREE.Group, name: string, x: number, y: number,
      z: number, width: number, height: number, depth: number,
      material: THREE.Material): void => {
      const mesh = new THREE.Mesh(block, material);
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      parent.add(mesh);
    };
    this.ship.name = 'battlefield-warship';
    for (let index = 0; index < 5; index++) {
      const localX = (index - 2) * 1.1;
      const section = new THREE.Group();
      section.name = `warship-section-${index}`;
      section.position.x = localX;
      part(section, 'warship-hull', 0, 0, 0, 1.12, .56, 1.6, hull);
      if (index >= 1 && index <= 3) {
        part(section, 'warship-deck', 0, .4, 0, 1.08, .32, 1.3, fittings);
      }
      if (index === 1) {
        part(section, 'warship-superstructure', .4, .86, 0,
          1.4, .82, 1, hull);
        part(section, 'warship-mast', 0, 1.65, 0, .12, 1, .12, fittings);
      }
      if (index === 3) part(section, 'warship-gun', .3, .58, 0,
        1.4, .15, .22, hull);
      this.ship.add(section);
      this.shipSections.push({ group: section, x: localX,
        halfWidth: index === 1 ? 1.12 : index === 3 ? 1 : .56 });
    }
    this.ship.visible = false;
    this.shipLayer.add(this.ship);

    for (let index = 0; index < 2; index++) {
      const planeMaterial = new THREE.MeshBasicMaterial({ color: '#252d31',
        transparent: true, opacity: 0, depthWrite: false, fog: false });
      this.aircraftMaterials.push(planeMaterial);
      this.materials.push(planeMaterial);
      const plane = new THREE.Group();
      plane.name = 'battlefield-aircraft';
      part(plane, 'aircraft-fuselage', 0, 0, 0, .52, .16, 3.2, planeMaterial);
      part(plane, 'aircraft-wings', 0, 0, -.18, 4.1, .12, .66, planeMaterial);
      part(plane, 'aircraft-tail', 0, 0, -1.3, 1.55, .12, .34, planeMaterial);
      plane.scale.setScalar(index === 0 ? .62 : .54);
      plane.visible = false;
      this.aircraft.push(plane);
      this.skyLayer.add(plane);
    }

    for (let index = 0; index < 2; index++) {
      const flashMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#e5c399', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const glowMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#a97455', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#252d31', transparent: true, opacity: 0, depthWrite: false,
        fog: false });
      this.materials.push(flashMaterial, glowMaterial, smokeMaterial);
      const group = new THREE.Group();
      group.name = 'battlefield-sky-flak-slot';
      const flash = new THREE.Sprite(flashMaterial);
      flash.name = 'sky-flak-flash';
      const glow = new THREE.Sprite(glowMaterial);
      glow.name = 'sky-flak-glow';
      const smoke = new THREE.Sprite(smokeMaterial);
      smoke.name = 'sky-flak-smoke';
      group.add(flash, glow, smoke);
      group.visible = false;
      this.skyLayer.add(group);
      this.flakSlots.push({ group, flash, glow, smoke,
        startedAtMs: -Infinity, layer: 'far' });
    }
  }

  private updateActivity(nowMs: number, bridgeHalfWidth: number): void {
    const events = this.activity.update(nowMs);
    const shipAge = nowMs - this.activity.shipStartedAtMs;
    this.ship.visible = shipAge >= 0 && shipAge < SHIP_PASS_MS;
    if (this.ship.visible) {
      const progress = shipAge / SHIP_PASS_MS;
      const x = this.activity.shipSide * this.activity.shipX * (2 * progress - 1);
      this.ship.position.set(x, -.15, 38);
      this.ship.rotation.y = this.activity.shipSide === 1 ? 0 : Math.PI;
      const edgeFade = Math.max(0, Math.min(1, progress / .08, (1 - progress) / .08));
      this.shipMaterials[0].opacity = edgeFade;
      this.shipMaterials[1].opacity = edgeFade;
      for (const section of this.shipSections) {
        const sectionX = x + (this.activity.shipSide === 1 ? section.x : -section.x);
        // Hard section masking keeps every visible piece outside the solid bridge footprint.
        section.group.visible = Math.abs(sectionX) > bridgeHalfWidth + section.halfWidth;
      }
    }
    for (let index = 0; index < this.aircraft.length; index++) {
      const pass = this.activity.aircraftPasses[index];
      const plane = this.aircraft[index];
      const aircraftAge = nowMs - pass.startedAtMs;
      plane.visible = aircraftAge >= 0 && aircraftAge < AIRCRAFT_PASS_MS;
      if (!plane.visible) continue;
      const progress = aircraftAge / AIRCRAFT_PASS_MS;
      plane.position.set(pass.side * (-26 + progress * 52), pass.y, pass.z);
      plane.rotation.y = pass.side === 1 ? -Math.PI / 2 : Math.PI / 2;
      this.aircraftMaterials[index].opacity = .28
        * Math.max(0, Math.min(1, progress / .16, (1 - progress) / .16));
    }
    if (events & SKY_FLAK_STARTED) {
      const slot = this.flakSlots.find((candidate) => !candidate.group.visible)
        ?? this.flakSlots.reduce((oldest, candidate) =>
          candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
      slot.group.position.set(this.activity.flakX, this.activity.flakY, -3);
      slot.startedAtMs = nowMs;
      slot.group.visible = true;
    }
    for (const slot of this.flakSlots) {
      if (!slot.group.visible) continue;
      const age = nowMs - slot.startedAtMs;
      if (age >= SKY_FLAK_SMOKE_MS) {
        slot.group.visible = false;
        continue;
      }
      slot.flash.visible = age < 85;
      slot.flash.scale.setScalar(1.15 + age * .004);
      (slot.flash.material as THREE.SpriteMaterial).opacity = slot.flash.visible
        ? .72 * (1 - age / 85) : 0;
      slot.glow.visible = age >= 45 && age < 270;
      slot.glow.scale.setScalar(1.5 + age * .003);
      (slot.glow.material as THREE.SpriteMaterial).opacity = slot.glow.visible
        ? .34 * (1 - age / 270) : 0;
      slot.smoke.visible = age >= 150;
      slot.smoke.position.y = (age - 150) * .00045;
      slot.smoke.scale.setScalar(1.3 + age * .0008);
      (slot.smoke.material as THREE.SpriteMaterial).opacity = slot.smoke.visible
        ? .42 * Math.min(1, (age - 150) / 250)
          * (1 - (age - 150) / (SKY_FLAK_SMOKE_MS - 150)) : 0;
    }
  }

  private updateArtillery(nowMs: number): void {
    const siteIndex = this.artillery.update(nowMs);
    if (siteIndex >= 0) {
      const site = ARTILLERY_SITES[siteIndex];
      const slot = this.impactSlots.find((candidate) => !candidate.group.visible)
        ?? this.impactSlots.reduce((oldest, candidate) =>
          candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
      const layer = site.layer === 'near' ? this.near
        : site.layer === 'mid' ? this.mid : this.beachhead;
      layer.add(slot.group);
      slot.group.position.set(site.x, site.y ?? 0, site.z);
      slot.group.scale.setScalar(site.layer === 'near' ? 1.22
        : site.layer === 'far' ? .68 : 1);
      slot.startedAtMs = nowMs;
      slot.layer = site.layer;
      (slot.smoke.material as THREE.SpriteMaterial).color.set(site.layer === 'near'
        ? '#20282b' : site.layer === 'mid' ? '#343e42' : '#536064');
      slot.group.visible = true;
    }
    for (const slot of this.impactSlots) {
      if (!slot.group.visible) continue;
      const ageMs = nowMs - slot.startedAtMs;
      if (ageMs >= ARTILLERY_SMOKE_MS) {
        slot.group.visible = false;
        continue;
      }
      const brightness = slot.layer === 'near' ? 1
        : slot.layer === 'far' ? .58 : .82;
      const flash = ageMs < ARTILLERY_FLASH_MS;
      slot.flash.visible = flash;
      slot.flash.position.set(0, 1.3, 0);
      slot.flash.scale.setScalar(2.7 + ageMs / ARTILLERY_FLASH_MS * .7);
      (slot.flash.material as THREE.SpriteMaterial).opacity = flash
        ? brightness * (1 - ageMs / ARTILLERY_FLASH_MS) : 0;
      const glowAge = Math.max(0, ageMs - 45);
      const glow = ageMs >= 45 && ageMs < ARTILLERY_GLOW_MS;
      slot.glow.visible = glow;
      slot.glow.position.set(0, 1.5, 0);
      slot.glow.scale.setScalar(3.2 + glowAge / ARTILLERY_GLOW_MS * 3.4);
      (slot.glow.material as THREE.SpriteMaterial).opacity = glow
        ? brightness * .85 * (1 - glowAge / ARTILLERY_GLOW_MS) : 0;
      const smokeAge = Math.max(0, ageMs - 220);
      const smoke = ageMs >= 220;
      slot.smoke.visible = smoke;
      slot.smoke.position.set(.25, 1.8 + smokeAge * .0007, .1);
      slot.smoke.scale.setScalar(3.4 + smokeAge * .0014);
      (slot.smoke.material as THREE.SpriteMaterial).opacity = smoke
        ? (slot.layer === 'far' ? .3 : slot.layer === 'near' ? .6 : .5)
          * Math.min(1, smokeAge / 350)
          * (1 - smokeAge / (ARTILLERY_SMOKE_MS - 220)) : 0;
    }
  }

  private material(color: string, transparent = false, opacity = 1): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, transparent, opacity,
      depthWrite: !transparent, roughness: 1 });
    this.materials.push(material);
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return mesh;
  }
}
