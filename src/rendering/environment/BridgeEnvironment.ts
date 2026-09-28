import * as THREE from 'three';

const SPAN_LENGTH = 300;
const JOINT_SPACING = 12;
const JOINT_COUNT = 18;
export const BATTLEFIELD_FOG_NEAR = 65;
export const BATTLEFIELD_FOG_FAR = 107;
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
    this.near.position.z = playerZ + 62;
    this.mid.position.z = playerZ + 79;
    this.far.position.z = playerZ + 92;
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
    const nearMaterial = this.material('#46545a');
    const nearAccent = this.material('#59676b');
    const midMaterial = this.material('#66767a');
    const midAccent = this.material('#738387');
    const farMaterial = this.material('#92a8aa');
    this.smokeTexture = this.createSmokeTexture();
    const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#4c5a5e', transparent: true, opacity: .43, depthWrite: false });
    this.materials.push(smokeMaterial);
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
    const smoke = (layer: THREE.Group, x: number, y: number, z: number,
      width: number, height: number): void => {
      const sprite = new THREE.Sprite(smokeMaterial);
      sprite.name = 'battlefield-smoke';
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

    // Open center preserves the combat lane; broken silhouettes enter at the edges.
    ruin(this.near, -13.3, -3, 5.2, 3.6, nearMaterial, -.16);
    ruin(this.near, -9.8, 2, .65, 4.2, nearAccent, .38);
    ruin(this.near, 14.8, 1, 5.8, 2.7, nearMaterial, .11);
    ruin(this.near, 11.7, -3, 2.1, 1.4, nearAccent, -.2);
    smoke(this.near, 15.2, 3.1, 1, 4, 5);
    smoke(this.near, 15.7, 4.5, 1.2, 5.3, 6.1);

    ruin(this.mid, -17.5, -4, 4.9, 4.8, midMaterial, -.08);
    ruin(this.mid, -12.4, 2, 2.7, 6.2, midAccent, .11);
    ruin(this.mid, 12.7, -2, 4.4, 3.1, midMaterial, .08);
    ruin(this.mid, 19.5, 4, 5.1, 5.3, midAccent, -.12);
    fire(this.mid, -17.2, -3.7);
    fire(this.mid, 19.3, 3.5);
    smoke(this.mid, -17.3, 3, -4, 4.1, 5.2);
    smoke(this.mid, -16.7, 5.1, -4.2, 5.9, 6.9);
    smoke(this.mid, -18.2, 7.3, -4.1, 7.2, 8.1);
    smoke(this.mid, 19.2, 4.2, 4, 4.6, 5.8);
    smoke(this.mid, 20.1, 6.5, 4.1, 6.3, 7.5);

    ruin(this.far, -23.6, 4, 4.8, 3.6, farMaterial, .1);
    ruin(this.far, -18.2, -3, 3.4, 2.4, farMaterial, -.1);
    ruin(this.far, 17.7, -2, 3.6, 2.9, farMaterial, .06);
    ruin(this.far, 27.3, 3, 5.3, 3.8, farMaterial, -.08);
    smoke(this.far, 26.8, 5.1, 3, 5.2, 6.5);
    smoke(this.far, 27.5, 7.1, 3.1, 6.7, 7.4);
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
