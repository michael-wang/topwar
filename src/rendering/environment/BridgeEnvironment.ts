import * as THREE from 'three';

const SPAN_LENGTH = 300;
const JOINT_SPACING = 12;
const JOINT_COUNT = 18;
export const BATTLEFIELD_FOG_NEAR = 76;
export const BATTLEFIELD_FOG_FAR = 108;
export const BATTLEFIELD_FOG_COLOR = '#8eaaae';

export class BridgeEnvironment {
  private readonly group = new THREE.Group();
  private readonly near = new THREE.Group();
  private readonly mid = new THREE.Group();
  private readonly far = new THREE.Group();
  private readonly previousBackground: THREE.Scene['background'];
  private readonly previousFog: THREE.Scene['fog'];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly joints: THREE.Mesh[] = [];
  private readonly smoke: { sprite: THREE.Sprite; x: number }[] = [];
  private smokeTexture: THREE.DataTexture | null = null;
  private readonly deck: THREE.Mesh;
  private readonly shoulders: THREE.Mesh[] = [];
  private readonly barriers: THREE.Mesh[] = [];
  private readonly water: THREE.Mesh;

  constructor(private readonly scene: THREE.Scene) {
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    scene.background = new THREE.Color(BATTLEFIELD_FOG_COLOR);
    scene.fog = new THREE.Fog(BATTLEFIELD_FOG_COLOR,
      BATTLEFIELD_FOG_NEAR, BATTLEFIELD_FOG_FAR);
    this.near.name = 'battlefield-near';
    this.mid.name = 'battlefield-mid';
    this.far.name = 'battlefield-far';
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
    this.scene.add(this.group, this.near, this.mid, this.far);
    this.update(0, 3, 0);
  }

  update(playerZ: number, trackHalfWidth: number, nowMs: number): void {
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
    for (let i = 0; i < this.smoke.length; i++) {
      this.smoke[i].sprite.position.x = this.smoke[i].x
        + Math.sin(nowMs * .00015 + i * 1.7) * .16;
    }
  }

  dispose(): void {
    this.scene.remove(this.group, this.near, this.mid, this.far, ...this.joints);
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.smokeTexture?.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private buildBattlefield(): void {
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const glowGeometry = new THREE.SphereGeometry(1, 8, 6);
    this.geometries.push(blockGeometry, glowGeometry);
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
    const glowMaterial = new THREE.MeshBasicMaterial({ color: '#b27a51',
      transparent: true, opacity: .38, depthWrite: false });
    this.materials.push(glowMaterial);

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
    const fire = (layer: THREE.Group, x: number, z: number): void => {
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.name = 'battlefield-fire-glow';
      glow.position.set(x, .25, z);
      glow.scale.set(1.45, .58, .65);
      layer.add(glow);
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
    fire(this.mid, -9.5, -5.8);
    fire(this.mid, 10.5, -3.7);
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
