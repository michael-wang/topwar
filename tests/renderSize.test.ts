import { describe, expect, it } from 'vitest';
import { coastalCameraFov, renderSize } from '../src/rendering/renderSize';

describe('renderSize', () => {
  it('uses actual container dimensions for the camera aspect', () => {
    expect(renderSize(360, 640)).toEqual({ width: 360, height: 640, aspect: 9 / 16 });
    expect(renderSize(600, 600).aspect).toBe(1);
  });

  it('rejects dimensions that would break the camera projection', () => {
    expect(() => renderSize(0, 640)).toThrow();
    expect(() => renderSize(360, Number.NaN)).toThrow();
  });
});

it('preserves horizontal lane coverage while taller coastal phones gain vertical coverage', () => {
  const reference=Math.tan(48*Math.PI/360)*(9/16);
  for(const [w,h] of [[390,844],[320,692],[412,915]]) {
    const fov=coastalCameraFov(w/h);
    expect(fov).toBeGreaterThan(48);
    expect(Math.tan(fov*Math.PI/360)*w/h).toBeCloseTo(reference);
  }
  expect(coastalCameraFov(9/16)).toBeCloseTo(48);
  expect(()=>coastalCameraFov(0)).toThrow();
});
