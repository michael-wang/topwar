import * as THREE from 'three';

const SPAN_LENGTH = 300;
const JOINT_SPACING = 12;
const JOINT_COUNT = 18;

export class BridgeEnvironment {
  private readonly group = new THREE.Group();
  private readonly horizon = new THREE.Group();
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
    this.buildHorizon();
    this.scene.add(this.group, this.horizon);
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
    this.horizon.position.z = playerZ + 78;
    for (let i = 0; i < this.smoke.length; i++) {
      this.smoke[i].sprite.position.x = this.smoke[i].x
        + Math.sin(nowMs * .00015 + i * 1.7) * .16;
    }
  }

  dispose(): void {
    this.scene.remove(this.group, this.horizon, ...this.joints);
    this.smokeTexture?.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private buildHorizon(): void {
    this.horizon.name = 'battlefield-horizon';
    const ruinMaterial = this.material('#647276');
    const darkRuinMaterial = this.material('#4c5b60');
    this.smokeTexture = this.createSmokeTexture();
    const smokeMaterial = new THREE.SpriteMaterial({ map: this.smokeTexture,
      color: '#48565b', transparent: true, opacity: .45, depthWrite: false });
    this.materials.push(smokeMaterial);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: '#b27a51',
      transparent: true, opacity: .42, depthWrite: false });
    this.materials.push(glowMaterial);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const height = [3.1, 5.2, 2.7, 4.3][i];
        const ruin = this.mesh(new THREE.BoxGeometry(2.3 + i * .45, height, 1.5),
          i % 2 ? darkRuinMaterial : ruinMaterial, 'battlefield-ruin');
        ruin.position.set(side * (11 + i * 4.3), height / 2 - .45, 3 + i * 2.5);
        ruin.rotation.z = side * (i % 2 ? .13 : -.09);
        this.horizon.add(ruin);
      }
      const glow = this.mesh(new THREE.SphereGeometry(1.3, 8, 6), glowMaterial,
        'battlefield-fire-glow');
      glow.position.set(side * 16, .35, 4);
      glow.scale.set(1.7, .6, .6);
      this.horizon.add(glow);
      for (let i = 0; i < 4; i++) {
        const puff = new THREE.Sprite(smokeMaterial);
        puff.name = 'battlefield-smoke';
        const x = side * (15 + i * .35);
        puff.position.set(x, 2.5 + i * 1.65, 3.4);
        puff.scale.set(3.6 + i * 1.3, 4.3 + i * 1.2, 1);
        this.smoke.push({ sprite: puff, x });
        this.horizon.add(puff);
      }
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
