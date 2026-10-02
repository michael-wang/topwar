import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ART } from '../src/art/ArtDirection';
import { illustratedMaterial } from '../src/rendering/art/IllustratedMaterial';
import { paintedBlockGeometry } from '../src/rendering/art/PaintedGeometry';
import { paintDaubTexture, sandWashTexture } from '../src/rendering/art/PaintedTextures';
import { framedBarTexture } from '../src/rendering/art/FramedBarTextures';
import { PlayerBodyMotion } from '../src/rendering/squad/PlayerBodyMotion';
import { applyArtTheme } from '../src/ui/ArtTheme';

it('keeps chipped/beveled props inside their original unit placement bounds', () => {
  const geometry = paintedBlockGeometry();
  const bounds = geometry.boundingBox!;
  expect(bounds.min.toArray()).toEqual([-.5, -.5, -.5]);
  expect(bounds.max.toArray()).toEqual([.5, .5, .5]);
  expect(geometry.getAttribute('position').count / 3).toBeLessThan(100);
  expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
  geometry.dispose();
});

it('paints quiet warm sand without byte overflow or noisy color inversions', () => {
  const texture = sandWashTexture();
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    expect(data[i]).toBeGreaterThan(225);
    expect(data[i]).toBeGreaterThanOrEqual(data[i + 1]);
    expect(data[i + 1]).toBeGreaterThan(data[i + 2]);
    expect(data[i + 3]).toBe(255);
  }
  expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  texture.dispose();
});

it('shares soft daub edges and rounded brass/ink bar structure without per-unit canvases', () => {
  const daub = paintDaubTexture(), frame = framedBarTexture(), fill = framedBarTexture(true);
  const pixel = (texture: THREE.DataTexture, x: number, y: number) =>
    Array.from(texture.image.data.slice((y * texture.image.width + x) * 4, (y * texture.image.width + x) * 4 + 4));
  expect(pixel(daub, 0, 0)[3]).toBe(0);
  expect(pixel(daub, 32, 32)[3]).toBeGreaterThan(150);
  expect(pixel(frame, 0, 0)[3]).toBe(0);
  expect(pixel(frame, 128, 24)[3]).toBe(255);
  expect(pixel(frame, 128, 5)).not.toEqual(pixel(frame, 128, 24));
  expect(pixel(fill, 128, 24)[0]).toBeGreaterThan(235);
  expect(pixel(fill, 0, 0)[3]).toBe(0);
  daub.dispose(); frame.dispose(); fill.dispose();
});

it('composes painted surfaces with the existing limb animation and installs only once', () => {
  const source = new THREE.MeshStandardMaterial();
  const motion = new PlayerBodyMotion(source, source);
  const hook = motion.normal.onBeforeCompile;
  illustratedMaterial(motion.normal, 'player');
  expect(motion.normal.onBeforeCompile).toBe(hook);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>' };
  motion.normal.onBeforeCompile(shader as unknown as Parameters<typeof hook>[0], {} as THREE.WebGLRenderer);
  expect(shader.vertexShader).toContain('limbPoint');
  expect(shader.vertexShader).toContain('vPaintPosition = transformed');
  expect(shader.fragmentShader).toContain('clothValue');
  expect(shader.uniforms).toHaveProperty('playerRecoil');
  expect(motion.normal.customProgramCacheKey()).toContain('player-limb-motion-v1|illustrated-player-v1');
  expect(motion.normal.roughness).toBe(1);
  expect(motion.normal.metalness).toBe(0);
  motion.dispose(); source.dispose();
});

it('feeds the DOM HUD from the same palette as the world bars', () => {
  const setProperty = vi.fn();
  applyArtTheme({ style: { setProperty } } as unknown as HTMLElement);
  expect(setProperty).toHaveBeenCalledWith('--art-frame', ART.bar.frame);
  expect(setProperty).toHaveBeenCalledWith('--art-ink', ART.bar.ink);
  expect(setProperty).toHaveBeenCalledWith('--art-xp-gold', ART.bar.xpGold);
});
