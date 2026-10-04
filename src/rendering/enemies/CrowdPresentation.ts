import type { MeshStandardMaterial } from 'three';
import { illustratedMaterial } from '../art/IllustratedMaterial';

// Atlas tunic selection and authored vertex colors are distinct material paths.
// This contract contains no combat or simulation values.
export interface CrowdPresentation {
  readonly materialStyle: 'legacy-atlas' | 'vertex-colors';
  readonly bodyTint: 'legacy-tunic' | 'authored';
  readonly gearTint?: 'authored';
  readonly scaleY?: number;
  readonly hitCompression?: number;
  readonly hpAnchor?: { readonly top: number; readonly width: number };
  readonly shadow?: { readonly width: number; readonly depth: number };
  readonly stepWeight?: { readonly shift: number; readonly roll: number; readonly compression: number };
}

export function prepareCrowdMaterial(material: MeshStandardMaterial, presentation: CrowdPresentation,
  surface: 'body' | 'gear' | 'death' = 'gear'): MeshStandardMaterial {
  return presentation.materialStyle === 'legacy-atlas'
    ? illustratedMaterial(material, surface === 'body' ? 'enemy' : 'world') : material;
}
