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
import { WarActivityScheduler, AIRCRAFT_PASS_MS } from './WarActivityScheduler';

export class BridgeEnvironment {
  getDebugStats(): { aircraft: number; activeAircraft: number } {
    return { aircraft: this.aircraft.length,
      activeAircraft: this.aircraft.filter((plane) => plane.visible).length };
  }
  private readonly skyLayer = new THREE.Group();
  private readonly previousBackground: THREE.Scene['background'];
  private readonly previousFog: THREE.Scene['fog'];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly activity = new WarActivityScheduler();
  private readonly aircraftMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly aircraft: THREE.Group[] = [];
  private sandTexture: THREE.DataTexture | null = null;
  private readonly transports = new OffshoreTransports();
  private readonly defenseBeach = new THREE.Group();
  private readonly coastalWater = new CoastalWater();
  private readonly coastalArchitecture = new CoastalArchitecture();
  private readonly coastalVegetation = new CoastalVegetation();
  private readonly coastalCloth = new CoastalCloth();
  private readonly coastalForeground = new CoastalForeground();
  private readonly coastalBackground = new THREE.Color(ART.coastalDefense.sky);
  private readonly coastalFog = new THREE.Fog(ART.coastalDefense.horizon, ART.coastalDefense.fogNear, ART.coastalDefense.fogFar);

  constructor(private readonly scene: THREE.Scene) {
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    this.skyLayer.name = 'battlefield-sky-activity';
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
    this.scene.add(this.skyLayer);
    this.update(0, 3.2, 0);
  }

  update(playerZ: number, trackHalfWidth: number, nowMs: number): void {
    this.transports.update(playerZ, nowMs, true);
    this.defenseBeach.visible = true;
    this.defenseBeach.position.z = playerZ;
    this.coastalWater.update(nowMs);
    this.coastalArchitecture.update(trackHalfWidth);
    this.coastalVegetation.update(trackHalfWidth, nowMs);
    this.coastalCloth.update(trackHalfWidth, nowMs);
    this.coastalForeground.update(trackHalfWidth);
    this.scene.background = this.coastalBackground;
    this.scene.fog = this.coastalFog;
    this.skyLayer.position.z = playerZ + 125;
    this.updateActivity(nowMs);
  }

  dispose(): void {
    this.coastalWater.dispose(); this.coastalArchitecture.dispose();
    this.coastalVegetation.dispose(); this.coastalCloth.dispose();
    this.coastalForeground.dispose();
    this.transports.dispose();
    this.scene.remove(this.defenseBeach, this.transports.group);
    this.scene.remove(this.skyLayer);
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.sandTexture?.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
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
  }

  private updateActivity(nowMs: number): void {
    this.activity.update(nowMs);
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

