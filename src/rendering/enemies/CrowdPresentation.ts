import type { MeshStandardMaterial } from 'three';
import { illustratedMaterial } from '../art/IllustratedMaterial';

// Atlas tunic selection and authored vertex colors are distinct material paths.
// This contract contains no combat or simulation values.
export interface CrowdPresentation {
  readonly materialStyle: 'legacy-atlas' | 'vertex-colors';
  readonly bodyTint: 'legacy-tunic' | 'authored';
}

export const LEGACY_CROWD_PRESENTATION: CrowdPresentation = {
  materialStyle: 'legacy-atlas', bodyTint: 'legacy-tunic',
};

export function prepareCrowdMaterial(material: MeshStandardMaterial, presentation: CrowdPresentation,
  surface: 'body' | 'gear' | 'death' = 'gear'): MeshStandardMaterial {
  return presentation.materialStyle === 'legacy-atlas'
    ? illustratedMaterial(material, surface === 'body' ? 'enemy' : 'world') : material;
}
