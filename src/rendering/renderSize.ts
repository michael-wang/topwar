import { ART } from '../art/ArtDirection';
export function renderSize(width: number, height: number): {
  width: number;
  height: number;
  aspect: number;
} {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Render dimensions must be finite positive numbers');
  }

  return { width, height, aspect: width / height };
}

// Taller phones gain vertical world coverage while retaining the authored lane width.
export function coastalCameraFov(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Camera aspect must be positive');
  const { verticalFov, referenceAspect } = ART.coastalDefense.camera;
  return 2 * Math.atan(Math.tan(verticalFov * Math.PI / 360) * referenceAspect / Math.min(aspect, referenceAspect)) * 180 / Math.PI;
}
