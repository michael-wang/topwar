import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { DefenseTracerPresentation } from '../rendering/projectiles/DefenseTracer';

// Evaluation presets and geometry are imported only by the DEV construction branch.
export const DEV_TRACERS = {
  P1: { name: 'Ivory dart', core: '#fff1a8', outline: '#080b10', coreLengthRatio: .90,
    size: { corePixels: 3.4, outlinePixels: 2.2, lengthPixels: 13, maxCoreWidth: .30, maxOutlineWidth: .19, maxLength: 1.2 } },
  P2: { name: 'Red tracer', core: '#ff381f', outline: '#080b10', coreLengthRatio: .92,
    size: { corePixels: 3.2, outlinePixels: 2, lengthPixels: 19, maxCoreWidth: .29, maxOutlineWidth: .18, maxLength: 1.65 } },
  P3: { name: 'Ink spear', core: '#fff2ce', outline: '#080b10', coreLengthRatio: .68,
    size: { corePixels: 1.8, outlinePixels: 4, lengthPixels: 17, maxCoreWidth: .16, maxOutlineWidth: .35, maxLength: 1.5 } },
} as const;
export type DevTracer = keyof typeof DEV_TRACERS;

export function devTracerGeometry(): BufferGeometry {
  // Pointed head at the authoritative anchor; the entire spear trails behind it.
  // Two shoulders distinguish the short head from the longer, narrowing tail.
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, -.5, 0, -.22, -.34, 0, -.65, 0, 0, -1, .34, 0, -.65, .5, 0, -.22,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export class DevProjectileControls {
  readonly element = document.createElement('div');
  private readonly label = document.createElement('div');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly geometry = devTracerGeometry();

  constructor(host: HTMLElement, private readonly select: (presentation: DefenseTracerPresentation) => void,
    close: () => void) {
    this.element.className = 'dev-projectile-controls';
    this.element.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:12px';
    this.label.style.cssText = 'grid-column:1/-1;font:700 12px var(--font-utility,sans-serif);color:#f5f5f0';
    this.label.setAttribute('aria-live', 'polite');
    this.element.append(this.label);
    for (const variant of Object.keys(DEV_TRACERS) as DevTracer[]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = variant; button.dataset.tracer = variant;
      button.title = DEV_TRACERS[variant].name;
      button.style.cssText = 'min-height:48px;border:2px solid #566578;border-radius:6px;color:#f5f5f0;font:700 15px var(--font-utility,sans-serif);cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => { this.activate(variant); button.blur(); close(); });
      this.buttons.push(button); this.element.append(button);
    }
    host.append(this.element);
    this.activate('P1');
  }

  private activate(variant: DevTracer): void {
    this.label.textContent = `TRACER: ${variant} · ${DEV_TRACERS[variant].name}`;
    for (const button of this.buttons) {
      const active = button.dataset.tracer === variant;
      button.setAttribute('aria-pressed', String(active));
      button.style.background = active ? '#7a3b1d' : '#263444';
    }
    this.select({ ...DEV_TRACERS[variant], geometry: this.geometry });
  }

  // Geometry ownership is transferred to the renderer, including WebGL restoration.
  dispose(): void { this.element.remove(); }
}
