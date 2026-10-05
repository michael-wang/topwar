import * as THREE from 'three';

export const GIANT_IMPACT_DUST = { slots: 3, puffsPerImpact: 4, durationMs: 400, size: .70, opacity: .32 } as const;
// One transient, pooled sand pass; no texture, ring, physics or persistent mark.
export class GiantImpactDust {
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(36);
  private readonly alphas = new Float32Array(12);
  private readonly starts = new Float64Array(3);
  private readonly origins = new Float32Array(6);
  private next = 0;
  private readonly material = new THREE.PointsMaterial({ color: '#a99679', size: GIANT_IMPACT_DUST.size,
    transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
  private readonly mesh: THREE.Points;
  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('puffAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float puffAlpha; varying float vPuffAlpha;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPuffAlpha = puffAlpha;');
      shader.fragmentShader = 'varying float vPuffAlpha;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nvec2 r = gl_PointCoord * 2. - 1.; float soft = max(0., 1. - dot(r,r)); diffuseColor.a *= vPuffAlpha * soft * soft;');
    };
    this.material.customProgramCacheKey = () => 'giant-sand-impact-v2.7.1';
    this.mesh = new THREE.Points(this.geometry, this.material); this.mesh.name = 'giant-death-impact-dust';
    this.mesh.frustumCulled = false; this.scene.add(this.mesh); this.reset();
  }
  spawn(x: number, z: number, startedAtMs: number): void {
    const slot = this.next++ % GIANT_IMPACT_DUST.slots;
    this.starts[slot] = startedAtMs; this.origins[slot*2] = x; this.origins[slot*2+1] = z;
  }
  update(nowMs: number): void {
    let active = false;
    for (let slot=0; slot<3; slot++) {
      const age=nowMs-this.starts[slot]; active ||= age>=0&&age<GIANT_IMPACT_DUST.durationMs;
    }
    if (!active) { this.mesh.visible=false; return; }
    for (let slot=0; slot<3; slot++) for (let puff=0; puff<4; puff++) {
      const i=slot*4+puff, age=nowMs-this.starts[slot], p=age/GIANT_IMPACT_DUST.durationMs;
      const visible=p>=0&&p<1;
      const a=puff*2.4+.3, spread=.28+.34*Math.max(0,Math.min(1,p));
      this.positions[i*3]=this.origins[slot*2]+Math.cos(a)*spread;
      this.positions[i*3+1]=visible ? .06+.12*Math.sin(Math.PI*p) : -100;
      this.positions[i*3+2]=this.origins[slot*2+1]+Math.sin(a)*spread*.8-.18;
      this.alphas[i]=visible ? GIANT_IMPACT_DUST.opacity*Math.sin(Math.PI*p)*(1-.09*puff) : 0;
    }
    this.mesh.visible=active;
    this.geometry.attributes.position.needsUpdate=this.geometry.attributes.puffAlpha.needsUpdate=true;
  }
  reset(): void { this.starts.fill(-Infinity); this.next=0; this.mesh.visible=false; this.alphas.fill(0); }
  dispose(): void { this.scene.remove(this.mesh); this.geometry.dispose(); this.material.dispose(); }
}
