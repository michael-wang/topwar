import { describe, expect, it } from 'vitest';
import { renderSize } from '../src/rendering/renderSize';

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
