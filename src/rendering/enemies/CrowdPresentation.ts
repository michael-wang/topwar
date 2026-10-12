// Presentation-only authored character dimensions; no combat values or atlas path.
export interface CrowdPresentation {
  readonly gearTint?: 'authored';
  readonly scaleY?: number;
  readonly hitCompression?: number;
  readonly hpAnchor?: { readonly top: number; readonly width: number };
  readonly shadow?: { readonly width: number; readonly depth: number };
  readonly stepWeight?: { readonly shift: number; readonly roll: number; readonly compression: number };
}
