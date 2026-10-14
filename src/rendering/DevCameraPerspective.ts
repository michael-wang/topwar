import type { PerspectiveCamera } from 'three';
import { coastalCameraFov } from './renderSize';

export type DevCameraMode = 'A' | 'B';

// Temporary P4.2 experiment. All callers are compile-time DEV gated.
export function applyDevCameraPerspective(camera: PerspectiveCamera, mode: DevCameraMode): void {
  const distance = Math.hypot(6.5, 22.5);
  const dolly = mode === 'B' ? 4 : 0;
  camera.position.set(0, 6.5 + dolly * 6.5 / distance, -10 - dolly * 22.5 / distance);
  camera.lookAt(0, 0, 12.5);
  // Match the original projection at the near soldier's body (Y=.8, Z=0).
  // Dolly along the view axis leaves its camera-space X/Y unchanged.
  const playerDepth = (10 * 22.5 + (6.5 - .8) * 6.5) / distance;
  camera.fov = mode === 'A' ? coastalCameraFov(camera.aspect)
    : 2 * Math.atan(Math.tan(coastalCameraFov(camera.aspect) * Math.PI / 360)
      * playerDepth / (playerDepth + dolly)) * 180 / Math.PI;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
