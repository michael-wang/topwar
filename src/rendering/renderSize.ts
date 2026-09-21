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
