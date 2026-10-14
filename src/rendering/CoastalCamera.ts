import type { PerspectiveCamera } from 'three';
import { coastalCameraFov } from './renderSize';

// Approved P4.2 B projection, shared by every scene and both build modes.
export function applyCoastalCamera(camera: PerspectiveCamera): void {
  const distance = Math.hypot(6.5, 22.5);
  const dolly = 4;
  camera.position.set(0, 6.5 + dolly * 6.5 / distance, -10 - dolly * 22.5 / distance);
  camera.lookAt(0, 0, 12.5);
  // Match the original projection at the near soldier's body (Y=.8, Z=0).
  // Dolly along the view axis leaves its camera-space X/Y unchanged.
  const playerDepth = (10 * 22.5 + (6.5 - .8) * 6.5) / distance;
  camera.fov = 2 * Math.atan(Math.tan(coastalCameraFov(camera.aspect) * Math.PI / 360)
      * playerDepth / (playerDepth + dolly)) * 180 / Math.PI;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
