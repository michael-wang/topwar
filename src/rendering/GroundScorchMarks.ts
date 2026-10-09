import * as THREE from 'three';

export const SCORCH = { capacity: 8, holdMs: 12000, durationMs: 18000 } as const;

// One shared procedural soot stamp; fixed CPU/GPU storage, no per-blast textures.
export class GroundScorchMarks {
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly opacity = new THREE.InstancedBufferAttribute(new Float32Array(SCORCH.capacity), 1);
  private readonly texture = createScorchTexture();
  private readonly material = new THREE.MeshBasicMaterial({ map: this.texture, color: '#302c28',
    transparent: true, depthWrite: false, toneMapped: false });
  private readonly mesh: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private readonly slots = Array.from({ length: SCORCH.capacity }, () => ({ atMs: -Infinity, x: 0, z: 0, diameter: 0, angle: 0 }));
  private cursor = 0;
  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('scorchOpacity', this.opacity);
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float scorchOpacity; varying float vScorchOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScorchOpacity = scorchOpacity;');
      shader.fragmentShader = `varying float vScorchOpacity;\n${shader.fragmentShader}`
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vScorchOpacity;');
    };
    this.material.customProgramCacheKey = () => 'grenade-ground-scorch';
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, SCORCH.capacity);
    this.mesh.name = 'grenade-ground-scorch'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.opacity.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh); this.reset();
  }
  present(x: number, z: number, radius: number, nowMs: number): void {
    const index = this.cursor++ % SCORCH.capacity;
    Object.assign(this.slots[index], { atMs: nowMs, x, z, diameter: radius * 1.25, angle: this.cursor * 2.3999632297 });
  }
  update(nowMs: number, originZ: number): void {
    let count = 0;
    for (const slot of this.slots) {
      const age = nowMs - slot.atMs;
      if (age < 0 || age >= SCORCH.durationMs) continue;
      this.transform.position.set(-slot.x, .046, slot.z - originZ);
      this.transform.rotation.set(-Math.PI / 2, 0, slot.angle);
      this.transform.scale.set(slot.diameter, slot.diameter, 1); this.transform.updateMatrix();
      this.mesh.setMatrixAt(count, this.transform.matrix);
      this.opacity.setX(count++, .72 * Math.min(1, (SCORCH.durationMs - age) / (SCORCH.durationMs - SCORCH.holdMs)));
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = this.opacity.needsUpdate = true;
  }
  get active(): number { return this.mesh.count; }
  reset(): void { this.slots.forEach(s => { s.atMs = -Infinity; }); this.cursor = 0; this.mesh.count = 0; this.mesh.visible = false; }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.dispose(); this.geometry.dispose(); this.texture.dispose(); this.material.dispose(); }
}

function createScorchTexture(): THREE.DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5) / size * 2 - 1, dy = (y + .5) / size * 2 - 1;
    const r = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
    const core = Math.max(0, Math.min(1, (.60 + .05 * Math.sin(angle * 7) - r) / .30));
    const rays = Math.max(0, Math.sin(angle * 17 + Math.sin(angle * 5))) ** 6;
    const grain = .8 + .2 * Math.sin(x * 7.13 + y * 13.71) ** 2;
    const alpha = Math.min(1, core + rays * Math.max(0, 1 - r) * .8) * grain;
    const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size); texture.needsUpdate = true;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; return texture;
}
