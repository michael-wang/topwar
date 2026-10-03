import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { XP_FILL_GRADIENT } from '../src/ui/xpPalette';
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
  expect(motion.normal.customProgramCacheKey()).toContain('player-limb-motion-v1|illustrated-player-v2');
  expect(motion.normal.roughness).toBe(1);
  expect(motion.normal.metalness).toBe(0);
  motion.dispose(); source.dispose();
});

it('shares centralized legacy and coastal tokens with the DOM HUD', () => {
  const setProperty = vi.fn();
  applyArtTheme({ style: { setProperty } } as unknown as HTMLElement);
  expect(setProperty).toHaveBeenCalledWith('--art-frame', ART.bar.frame);
  expect(setProperty).toHaveBeenCalledWith('--art-ink', ART.bar.ink);
  expect(setProperty).toHaveBeenCalledWith('--art-xp-gradient', XP_FILL_GRADIENT);
  expect(setProperty).toHaveBeenCalledWith('--coast-plaster', ART.coastalUi.plaster);
  expect(setProperty).toHaveBeenCalledWith('--coast-ink', ART.coastalUi.ink);
  expect(setProperty).toHaveBeenCalledWith('--coast-foam', ART.coastalUi.foam);
});


it('gives enemy health a cool navy frame and red-family semantic fills, leaving legacy frames intact', () => {
  const enemyFrame = framedBarTexture(false, ART.enemyHealth);
  const legacyFrame = framedBarTexture();
  const at = (128 + 5 * 256) * 4;
  const enemyPixel = Array.from(enemyFrame.image.data.slice(at, at+3));
  const legacyPixel = Array.from(legacyFrame.image.data.slice(at, at+3));
  expect(enemyPixel[0]).toBeGreaterThan(230); // thin ivory keyline
  const center = (128 + 24 * 256) * 4;
  expect(enemyFrame.image.data[center + 2]).toBeGreaterThan(enemyFrame.image.data[center]);
  expect(legacyPixel[0]).toBeGreaterThan(legacyPixel[2]);
  expect(ART.enemyHealth.heavy).toBe('#f2555f');
  expect(ART.enemyHealth.heavy).not.toBe(ART.faction.grunt);
  expect(ART.enemyHealth.giant).toBe('#ef4d59');
  expect(ART.enemyHealth.heavy).not.toBe(ART.faction.gold);
  enemyFrame.dispose(); legacyFrame.dispose();
});
