import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyCoastalCamera } from '../src/rendering/CoastalCamera';

// Measured from P4.2 B at 3a814f9; these are final responsive FOVs, not reference FOVs.
it.each([[350, 47.96669656920418, 590.6587006968291], [390, 43.5288808422899, 609.9339807764667]])(
  'retains the accepted near-player composition at %ipx and after resize', (width, fov, playerY) => {
    const camera = new PerspectiveCamera(48, width / 844, .1, 180);
    applyCoastalCamera(camera);
    expect(camera.fov).toBeCloseTo(fov, 8);
    expect(camera.position.distanceTo(new Vector3(0, 6.5, -10))).toBeCloseTo(4, 12);
    expect(camera.getWorldDirection(new Vector3()).distanceTo(new Vector3(0, -6.5, 22.5).normalize())).toBeLessThan(1e-12);
    expect((1 - new Vector3(0, .8, 0).project(camera).y) * 422).toBeCloseTo(playerY, 8);
    const projection = camera.projectionMatrix.clone(), world = camera.matrixWorld.clone();
    camera.aspect = 1; applyCoastalCamera(camera);
    camera.aspect = width / 844; applyCoastalCamera(camera);
    expect(camera.projectionMatrix.elements).toEqual(projection.elements);
    expect(camera.matrixWorld.elements).toEqual(world.elements);
  });
