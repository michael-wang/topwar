import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Team = 'player' | 'enemy';

export interface ToySoldier {
  root: THREE.Group;
  body: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  helmet: THREE.Group;
  muzzle: THREE.Object3D | null;
  colorMeshes: THREE.Mesh[];
}

const blue = 0x2575ed;
const red = 0xef5b52;
const dark = 0x25303a;

function material(color: number, roughness = 0.64, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true });
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material,
  position: [number, number, number], scale?: [number, number, number]): THREE.Mesh {
  const part = new THREE.Mesh(geometry, mat);
  part.position.set(...position);
  if (scale) part.scale.set(...scale);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function ball(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number],
  radius: number, scale: [number, number, number] = [1, 1, 1]): THREE.Mesh {
  return mesh(parent, new THREE.SphereGeometry(radius, 24, 16), mat, position, scale);
}

function box(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number],
  size: [number, number, number], radius = 0.08): THREE.Mesh {
  return mesh(parent, new RoundedBoxGeometry(...size, 3, radius), mat, position);
}

function cylinder(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number],
  radiusTop: number, radiusBottom: number, height: number, segments = 24): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat, position);
}

function line(parent: THREE.Object3D, mat: THREE.Material, points: [number, number, number][], radius: number): void {
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  mesh(parent, new THREE.TubeGeometry(path, 16, radius, 6, false), mat, [0, 0, 0]);
}

function makeHelmet(parent: THREE.Group, primary: THREE.Material, trim: THREE.Material, boss: boolean): THREE.Group {
  const helmet = new THREE.Group();
  helmet.position.set(0, 2.8, -0.03);
  helmet.scale.setScalar(boss ? 0.96 : 1);
  parent.add(helmet);

  // Flattened hemisphere plus broad rigid rim reads as a steel helmet, not a cap.
  const shell = mesh(helmet, new THREE.SphereGeometry(0.75, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2 + 0.13),
    primary, [0, 0.03, 0], [1, 0.75, 0.91]);
  shell.rotation.y = 0.15;
  mesh(helmet, new THREE.SphereGeometry(0.76, 32, 10, 0, Math.PI * 2, Math.PI / 2 - 0.08, 0.18),
    trim, [0, 0.03, 0], [1.02, 0.75, 0.93]);
  ball(helmet, primary, [0, -0.012, 0.025], 0.75, [1.1, 0.105, 1.02]);
  ball(helmet, trim, [0, -0.088, 0.03], 0.75, [1.12, 0.045, 1.05]);
  for (const x of [-0.55, 0.55]) ball(helmet, trim, [x, -0.01, 0.22], 0.045);
  if (boss) {
    box(helmet, trim, [0, 0.35, 0.67], [0.27, 0.28, 0.08], 0.05);
    box(helmet, material(0xe5bd56, 0.35, 0.45), [0, 0.35, 0.73], [0.12, 0.13, 0.025], 0.02);
  }
  return helmet;
}

function makeRifle(parent: THREE.Group, steel: THREE.Material, grip: THREE.Material): THREE.Object3D {
  const rifle = new THREE.Group();
  rifle.position.set(0.23, 1.67, 0.57);
  parent.add(rifle);
  box(rifle, steel, [0, 0, 0], [0.32, 0.34, 0.72], 0.075);
  box(rifle, grip, [-0.03, -0.09, -0.36], [0.28, 0.23, 0.45], 0.05);
  const barrel = cylinder(rifle, steel, [0, 0.055, 0.73], 0.105, 0.105, 1.15, 16);
  barrel.rotation.x = Math.PI / 2;
  const tip = cylinder(rifle, material(0x101720, 0.32, 0.25), [0, 0.055, 1.32], 0.13, 0.13, 0.16, 16);
  tip.rotation.x = Math.PI / 2;
  box(rifle, steel, [0.02, 0.24, -0.08], [0.12, 0.16, 0.31], 0.025);
  box(rifle, grip, [0.05, -0.32, 0.08], [0.2, 0.43, 0.18], 0.04);
  box(rifle, grip, [0.05, -0.36, 0.35], [0.23, 0.42, 0.23], 0.05);
  box(rifle, material(0xb8c4c9, 0.38, 0.55), [0, 0.06, 1.41], [0.12, 0.13, 0.03], 0.015);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.055, 1.5);
  rifle.add(muzzle);
  return muzzle;
}

export function createToySoldier(team: Team, boss = false): ToySoldier {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  if (boss) root.scale.set(2.0, 2.05, 1.9);
  const primary = material(team === 'player' ? blue : red, 0.31, 0.08);
  const primaryLight = material(team === 'player' ? 0x4aa0ff : 0xff8372, 0.34);
  const trim = material(team === 'player' ? 0x15469a : 0xac3034, 0.48);
  const cloth = material(team === 'player' ? 0x2e8fc2 : 0x8a4b3f, 0.82);
  const pants = material(team === 'player' ? 0x2365bb : 0xb9473d, 0.79);
  const skin = material(0xeeb681, 0.82);
  const skinShade = material(0xce916b, 0.85);
  const hair = material(0x4c3027, 0.95);
  const leather = material(0x65463a, 0.84);
  const glove = material(0x67443a, 0.8);
  const boot = material(0x49382f, 0.85);
  const steel = material(dark, 0.4, 0.16);
  const belt = material(0x55515a, 0.81);
  const brass = material(0xc7a16a, 0.46, 0.16);
  const eye = material(0x202020, 0.65);
  const white = material(0xffffff, 0.5);
  const colorMeshes: THREE.Mesh[] = [];

  // Head and face are deliberately uncovered; the reference relies on expression.
  ball(body, hair, [0, 2.51, -0.1], 0.65, [1.0, 0.94, 0.86]);
  ball(body, skin, [0, 2.47, 0.08], 0.62, [1.01, 0.91, 0.88]);
  for (const side of [-1, 1]) {
    ball(body, skin, [side * 0.62, 2.41, 0.04], 0.17, [0.8, 1.1, 0.66]);
    ball(body, skinShade, [side * 0.68, 2.39, 0.11], 0.053);
    if (team === 'player') ball(body, white, [side * 0.235, 2.46, 0.58], 0.082, [0.92, 1.1, 0.18]);
    ball(body, eye, [side * 0.235, 2.46, 0.606], team === 'enemy' ? 0.075 : 0.083, [0.82, 1.05, 0.28]);
    ball(body, white, [side * 0.235 - 0.02, 2.49, 0.63], 0.016);
    const brow = box(body, hair, [side * 0.24, 2.65, 0.57],
      team === 'enemy' && !boss ? [0.23, 0.055, 0.05] : [0.32, 0.075, 0.065], 0.02);
    brow.rotation.z = -side * (team === 'enemy' && !boss ? 0.1 : 0.18);
  }
  ball(body, skinShade, [0, 2.27, 0.65], 0.12, [1, 0.75, 0.72]);
  if (team === 'enemy' && !boss) {
    line(body, hair, [[-0.085, 2.13, 0.59], [0, 2.1, 0.62], [0.085, 2.13, 0.59]], 0.013);
  } else {
    line(body, hair, [[-0.12, 2.15, 0.58], [0, 2.17, 0.63], [0.12, 2.15, 0.58]], 0.026);
  }
  const helmet = makeHelmet(body, primary, trim, boss);

  // Cloth, straps, vest, belt and pockets stay distinct to avoid a color blob.
  ball(body, cloth, [0, 1.62, -0.01], 0.66, [1.1, 0.82, 0.8]);
  const vest = box(body, primary, [0, 1.7, 0.38], boss ? [1.35, 0.73, 0.29] : [1.05, 0.65, 0.23], 0.13);
  colorMeshes.push(vest);
  box(body, trim, [0, 1.67, 0.54], [0.54, 0.39, 0.07], 0.06);
  box(body, primaryLight, [0, 1.89, 0.56], [0.41, 0.12, 0.055], 0.035);
  for (const side of [-1, 1]) {
    const strap = box(body, leather, [side * 0.39, 1.74, 0.55], [0.12, 0.67, 0.09], 0.03);
    strap.rotation.z = side * 0.1;
    box(body, leather, [side * 0.38, 1.42, 0.59], [0.25, 0.18, 0.11], 0.03);
    if (boss) box(body, primary, [side * 0.72, 1.87, 0.08], [0.39, 0.28, 0.48], 0.09);
  }
  box(body, belt, [0, 1.24, 0.32], [1.12, 0.18, 0.27], 0.035);
  box(body, brass, [0, 1.24, 0.49], [0.25, 0.17, 0.04], 0.02);
  const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  for (const index of [0, 1] as const) {
    const side = index === 0 ? -1 : 1;
    const leg = legs[index];
    leg.position.set(side * 0.35, 1.13, 0);
    body.add(leg);
    ball(leg, pants, [0, -0.27, 0.02], 0.34, [1.06, 1.2, 0.99]);
    cylinder(leg, cloth, [0, -0.49, 0.03], 0.3, 0.3, 0.12);
    box(leg, boot, [0, -0.78, 0.13], [0.61, 0.48, 0.83], 0.16);
    box(leg, leather, [0, -0.82, 0.52], [0.52, 0.11, 0.11], 0.03);
    const arm = arms[index];
    arm.position.set(side * 0.68, 1.91, 0.01);
    body.add(arm);
    ball(arm, cloth, [side * 0.12, -0.19, 0], 0.3, [1.05, 1.1, 1]);
    ball(arm, skin, [side * 0.15, -0.49, 0.04], 0.23, [0.95, 1.2, 0.96]);
    ball(arm, glove, [side * 0.15, -0.7, 0.08], 0.25, [1.03, 0.95, 1.04]);
    box(arm, leather, [side * 0.15, -0.55, 0.06], [0.34, 0.13, 0.35], 0.04);
  }

  let muzzle: THREE.Object3D | null = null;
  if (team === 'player') {
    arms[0].rotation.x = -0.74;
    arms[1].rotation.x = -0.79;
    muzzle = makeRifle(body, steel, leather);
  }
  return { root, body, arms, legs, helmet, muzzle, colorMeshes };
}

export function poseRunning(soldier: ToySoldier, seconds: number): void {
  const phase = seconds * 13;
  const stride = Math.sin(phase);
  soldier.legs[0].rotation.x = stride * 0.68;
  soldier.legs[1].rotation.x = -stride * 0.68;
  soldier.arms[0].rotation.x = -stride * 0.82;
  soldier.arms[1].rotation.x = stride * 0.82;
  soldier.body.rotation.x = 0.23;
  soldier.body.rotation.z = Math.sin(phase) * 0.045;
  soldier.body.position.y = Math.abs(Math.sin(phase)) * 0.12;
}

export function disposeSoldier(soldier: ToySoldier): void {
  soldier.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) mat.dispose();
  });
}
