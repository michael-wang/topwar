import * as THREE from 'three';
// Character-space upper mass rotates gently backward about the waist, then sinks.
// Shoes/hands are authored separately; this local pose layers with lethal recoil.
export function lethalUpperMatrix(amount: number, sink: number, tilt: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(0, .34 - sink * amount, 0)
    .multiply(new THREE.Matrix4().makeRotationX(tilt * amount))
    .multiply(new THREE.Matrix4().makeTranslation(0, -.34, 0));
}
