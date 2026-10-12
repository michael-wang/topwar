import { OffshoreTransports } from './OffshoreTransports';
import { CoastalWater } from './CoastalWater';
import { CoastalArchitecture } from './CoastalArchitecture';
import { CoastalVegetation } from './CoastalVegetation';
import { CoastalCloth } from './CoastalCloth';
import { CoastalForeground } from './CoastalForeground';
import { ART } from '../../art/ArtDirection';
import { illustratedMaterial } from '../art/IllustratedMaterial';
import { paintedBlockGeometry } from '../art/PaintedGeometry';
import { sandWashTexture } from '../art/PaintedTextures';
import * as THREE from 'three';
import { unfoggedBasicMaterial } from '../art/unfoggedBasicMaterial';
import { ARTILLERY_SITES, ArtilleryScheduler, type ArtilleryLayer } from './ArtilleryScheduler';
import { WarActivityScheduler, SKY_FLAK_STARTED, AIRCRAFT_PASS_MS } from './WarActivityScheduler';
import { InfernoSurgeScheduler } from './InfernoSurgeScheduler';

export const BATTLEFIELD_FOG_NEAR = 76;
export const BATTLEFIELD_FOG_FAR = 108;
export const BATTLEFIELD_FOG_COLOR = ART.world.fog;
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
    return { smoke: 0, infernoSources: this.infernoSources.length,
      impactSlots: this.impactSlots.length,
      activeImpacts: this.impactSlots.filter((slot) => slot.group.visible).length,
      flakSlots: this.flakSlots.length,
      activeFlak: this.flakSlots.filter((slot) => slot.group.visible).length,
      aircraft: this.aircraft.length,
      activeAircraft: this.aircraft.filter((plane) => plane.visible).length,
      shipSections: 0 };
  }
  private readonly near = new THREE.Group();
  private readonly mid = new THREE.Group();
  private readonly beachhead = new THREE.Group();
  private readonly inferno = new THREE.Group();
  private readonly shipLayer = new THREE.Group();
  private readonly skyLayer = new THREE.Group();
  private readonly previousBackground: THREE.Scene['background'];
  private readonly previousFog: THREE.Scene['fog'];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly artillery = new ArtilleryScheduler();
  private readonly activity = new WarActivityScheduler();
  private readonly infernoSurges = new InfernoSurgeScheduler();
  private readonly infernoSources: InfernoVisual[] = [];
  private readonly impactSlots: ImpactSlot[] = [];
  private readonly flakSlots: ImpactSlot[] = [];
  private readonly aircraftMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly aircraft: THREE.Group[] = [];
  private smokeTexture: THREE.DataTexture | null = null;
  private sandTexture: THREE.DataTexture | null = null;
  private readonly transports = new OffshoreTransports();
  private readonly defenseBeach = new THREE.Group();
  private readonly coastalWater = new CoastalWater();
  private readonly coastalArchitecture = new CoastalArchitecture();
  private readonly coastalVegetation = new CoastalVegetation();
  private readonly coastalCloth = new CoastalCloth();
  private readonly coastalForeground = new CoastalForeground();
  private defenseMode = false;
  private readonly coastalBackground = new THREE.Color(ART.coastalDefense.sky);
  private readonly coastalFog = new THREE.Fog(ART.coastalDefense.horizon, ART.coastalDefense.fogNear, ART.coastalDefense.fogFar);

  constructor(private readonly scene: THREE.Scene) {
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    scene.background = new THREE.Color(BATTLEFIELD_FOG_COLOR);
    scene.fog = new THREE.Fog(BATTLEFIELD_FOG_COLOR,
      BATTLEFIELD_FOG_NEAR, BATTLEFIELD_FOG_FAR);
    this.near.name = 'battlefield-near';
    this.mid.name = 'battlefield-mid';
    this.beachhead.name = 'distant-artillery-layer';
    this.beachhead.visible = false;
    this.inferno.name = 'battlefield-deep-inferno';
    this.shipLayer.name = 'battlefield-water-traffic';
    this.skyLayer.name = 'battlefield-sky-activity';
    this.buildBattlefield();
    this.buildInferno();
    this.buildArtillery();
    this.buildActivity();
    const sandMaterial = this.material(ART.coastalDefense.sand, false, 1, true);
    sandMaterial.map = this.sandTexture = sandWashTexture();
    this.sandTexture.wrapS = THREE.RepeatWrapping; this.sandTexture.repeat.set(10, 1);
    // Keep the near beach edge fixed while the far edge follows the visual coast.
    const sandNearZ = -47;
    const sand = this.mesh(new THREE.PlaneGeometry(150, ART.coastalDefense.shorelineZ - sandNearZ), sandMaterial, 'defense-sand');
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, .005, (ART.coastalDefense.shorelineZ + sandNearZ) / 2);
    this.defenseBeach.add(sand, this.coastalWater.group, this.coastalArchitecture.group,
      this.coastalVegetation.group, this.coastalCloth.group, this.coastalForeground.group);
    const duneMaterial = this.material(ART.coastalDefense.sandShade);
    // CoastalWater owns surf; retain only the existing side dunes here.
    for (let patch = 0; patch < 20; patch += 3) {
        const dune = this.mesh(new THREE.SphereGeometry(1, 8, 5), duneMaterial, 'beach-dune');
        dune.position.set((patch % 2 ? 1 : -1) * (9 + patch), -.2, 10 + patch * 2);
        dune.scale.set(4, .55, 6);
        this.defenseBeach.add(dune);
    }
    this.defenseBeach.name = 'stationary-defense-beach';
    this.defenseBeach.visible = true;
    this.scene.add(this.defenseBeach, this.transports.group);
    this.scene.add(this.near, this.mid, this.beachhead, this.inferno,
      this.shipLayer, this.skyLayer);
    this.update(0, 3.2, 0);
  }

  update(playerZ: number, trackHalfWidth: number, nowMs: number, defenseMode = true): void {
    this.defenseMode = true;
    this.transports.update(playerZ, nowMs, true);
    this.defenseBeach.visible = defenseMode;
    this.defenseBeach.position.z = playerZ;
    this.coastalWater.update(nowMs);
    this.coastalArchitecture.update(trackHalfWidth);
    this.coastalVegetation.update(trackHalfWidth, nowMs);
    this.coastalCloth.update(trackHalfWidth, nowMs);
    this.coastalForeground.update(trackHalfWidth);
    this.scene.background = this.coastalBackground;
    this.scene.fog = this.coastalFog;
    const bridgeHalfWidth = Math.max(trackHalfWidth + 1, 4);
    this.near.position.set(0, 0, playerZ + 52);
    this.mid.position.set(0, 0, playerZ + 76);
    this.beachhead.position.set(Math.sin(playerZ * .003) * .02, 0, playerZ + 125);
    this.inferno.position.set(Math.sin(playerZ * .002) * .01, 0, playerZ + 142);
    this.shipLayer.position.z = playerZ + 60;
    this.skyLayer.position.z = playerZ + 125;
    this.updateArtillery(nowMs, defenseMode ? trackHalfWidth : undefined);
    this.updateActivity(nowMs, bridgeHalfWidth);
    this.updateInferno(nowMs);
  }

  dispose(): void {
    this.coastalWater.dispose(); this.coastalArchitecture.dispose();
    this.coastalVegetation.dispose(); this.coastalCloth.dispose();
    this.coastalForeground.dispose();
    this.transports.dispose();
    this.scene.remove(this.defenseBeach, this.transports.group);
    this.scene.remove(this.near, this.mid, this.beachhead, this.inferno,
      this.shipLayer, this.skyLayer);
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.smokeTexture?.dispose();
    this.sandTexture?.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private buildBattlefield(): void { this.smokeTexture = this.createSmokeTexture(); }

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
        color: ART.fx.core, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const glowMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: ART.fx.impact, transparent: true, opacity: 0, depthWrite: false,
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

  preparationObjects(): THREE.Object3D[] { return this.aircraft; }

  private buildActivity(): void {
    const block = paintedBlockGeometry();
    this.geometries.push(block);

    const part = (parent: THREE.Group, name: string, x: number, y: number,
      z: number, width: number, height: number, depth: number,
      material: THREE.Material): void => {
      const mesh = new THREE.Mesh(block, material);
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      parent.add(mesh);
    };


    for (let index = 0; index < 2; index++) {
      const planeMaterial = unfoggedBasicMaterial({ color: ART.world.steel,
        transparent: true, opacity: 0, depthWrite: false });
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
        color: ART.fx.gold, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const glowMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: '#a97455', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false });
      const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
        color: ART.world.steel, transparent: true, opacity: 0, depthWrite: false,
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
      if (age < 0 || age >= SKY_FLAK_SMOKE_MS) {
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

  private updateArtillery(nowMs: number, defenseHalfWidth?: number): void {
    const siteIndex = this.artillery.update(nowMs);
    if (siteIndex >= 0) {
      const site = ARTILLERY_SITES[siteIndex];
      const slot = this.impactSlots.find((candidate) => !candidate.group.visible)
        ?? this.impactSlots.reduce((oldest, candidate) =>
          candidate.startedAtMs < oldest.startedAtMs ? candidate : oldest);
      const layer = site.layer === 'near' ? this.near
        : site.layer === 'mid' ? this.mid : this.beachhead;
      layer.add(slot.group);
      slot.group.position.set(defenseHalfWidth !== undefined ? Math.sign(site.x) * (defenseHalfWidth + 2.6) : site.x,
        site.y ?? 0, this.defenseMode && site.layer !== 'far' ? (site.layer === 'near' ? -15 : -26) : site.z);
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
      if (ageMs < 0 || ageMs >= ARTILLERY_SMOKE_MS) {
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

  private material(color: string, transparent = false, opacity = 1, ground = false): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, transparent, opacity,
      depthWrite: !transparent, roughness: 1 });
    illustratedMaterial(material, ground ? 'ground' : 'world');
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
