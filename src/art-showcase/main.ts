import * as THREE from 'three';
import { createToySoldier, disposeSoldier, poseRunning, type ToySoldier } from './ToySoldier';
import { deathPose, SHOWCASE_HEIGHT, SHOWCASE_WIDTH, VIEWS, type ShowcaseView } from './spec';
import './showcase.css';

if (!import.meta.env.DEV) throw new Error('Art showcase is available in Vite development only');

const mount = document.querySelector<HTMLElement>('#showcase');
if (!mount) throw new Error('Art showcase mount is missing');

const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.classList.add('capture');
let selected = VIEWS.find((view) => view.id === params.get('scene'))?.id ?? 'comparison';
const still = params.has('still');
const stillTime = Number(params.get('t') ?? (selected === 'death' ? 0.23 : 0.15));
mount.innerHTML = `
  <header><span class="eyebrow">TOPWAR / VISUAL DEVELOPMENT</span><h1>MODERN TOY SOLDIERS</h1>
    <p>Isolated art approval scene · fixed 720 × 1280 render · no gameplay state</p></header>
  <div class="layout"><div class="canvas-shell"><canvas id="art-canvas" width="720" height="1280"></canvas>
    <div class="canvas-caption"><span id="shot-name"></span><span>ART STUDY · V3</span></div></div>
    <aside><h2>Review shots</h2><div id="view-controls"></div>
      <p class="aside-note">Use <code>?scene=player&amp;still=1&amp;t=0.15</code> for repeatable capture. The showcase does not load the game simulation or its renderers.</p>
      <button id="save-shot" type="button">Save 720 × 1280 PNG</button>
      <p class="aside-note">Reference intent: expressive faces, steel helmets, distinct cloth and skin, small luminous shots, and a giant soldier Boss.</p>
    </aside></div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#art-canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SHOWCASE_WIDTH, SHOWCASE_HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaeb7bf);
scene.fog = new THREE.Fog(0xaeb7bf, 13, 25);
const camera = new THREE.OrthographicCamera(-2.8, 2.8, 5, -5, 0.1, 100);
const ambient = new THREE.HemisphereLight(0xffffff, 0xb1b4b0, 2.25);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-4, 8, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9;
key.shadow.camera.right = 9;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -9;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0xc0ddff, 1.55);
rim.position.set(5, 5, -6);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xaeb6ba, roughness: 0.93 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);
const runway = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 60),
  new THREE.MeshStandardMaterial({ color: 0x858e98, roughness: 0.96 }));
runway.rotation.x = -Math.PI / 2;
runway.receiveShadow = true;
scene.add(runway);
for (const x of [-3.25, 3.25]) {
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 60),
    new THREE.MeshBasicMaterial({ color: 0xcbd0d0 }));
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(x, 0.006, 0);
  scene.add(edge);
}
const stage = new THREE.Group();
scene.add(stage);
const soldiers: ToySoldier[] = [];
let runner: ToySoldier | null = null;
let dying: ToySoldier | null = null;
let boss: ToySoldier | null = null;
let muzzle: THREE.Group | null = null;
let bullet: THREE.Group | null = null;
let startSeconds = performance.now() / 1000;

function setCamera(position: [number, number, number], target: [number, number, number], height: number): void {
  camera.position.set(...position);
  camera.lookAt(...target);
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.left = -height * 0.28125;
  camera.right = height * 0.28125;
  camera.updateProjectionMatrix();
}

function addSoldier(team: 'player' | 'enemy', position: [number, number, number], size = 1, isBoss = false): ToySoldier {
  const soldier = createToySoldier(team, isBoss);
  soldier.root.position.set(...position);
  soldier.root.scale.multiplyScalar(size);
  stage.add(soldier.root);
  soldiers.push(soldier);
  return soldier;
}

function glow(color: number, radius: number, opacity: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
}

function makeShot(anchor: THREE.Object3D, position: [number, number, number], length = 1.58): { flash: THREE.Group; tracer: THREE.Group } {
  const flash = new THREE.Group();
  flash.position.set(...position);
  anchor.add(flash);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffcb54, toneMapped: false, transparent: true, opacity: 0.96, depthWrite: false }));
  core.scale.set(0.62, 0.62, 1.55);
  flash.add(core);
  const bloom = glow(0xff9b26, 0.31, 0.55);
  bloom.scale.set(0.8, 0.8, 1.2);
  flash.add(bloom);
  for (let i = 0; i < 7; i++) {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(i % 2 ? 0.045 : 0.075, i % 2 ? 0.36 : 0.56, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffa928 : 0xffdc76, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
    ray.rotation.z = (i * Math.PI * 2) / 7;
    ray.position.set(Math.sin(ray.rotation.z) * 0.17, Math.cos(ray.rotation.z) * 0.17, 0.04);
    flash.add(ray);
  }
  const tracer = new THREE.Group();
  anchor.add(tracer);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.005, length, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6ce, toneMapped: false }));
  tube.rotation.x = Math.PI / 2;
  tracer.add(tube);
  const aura = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.022, length * 1.13, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb638, transparent: true, opacity: 0.43, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.rotation.x = Math.PI / 2;
  tracer.add(aura);
  const outerGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.035, length * 1.1, 12),
    new THREE.MeshBasicMaterial({ color: 0xffbd55, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending }));
  outerGlow.rotation.x = Math.PI / 2;
  tracer.add(outerGlow);
  const tip = glow(0xffe89b, 0.064, 0.95);
  tip.position.z = length * 0.48;
  tracer.add(tip);
  return { flash, tracer };
}

function clearStage(): void {
  for (const soldier of soldiers) disposeSoldier(soldier);
  soldiers.length = 0;
  for (const child of [...stage.children]) {
    stage.remove(child);
    child.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of materials) mat.dispose();
    });
  }
  runner = dying = boss = null;
  muzzle = bullet = null;
}

function buildView(view: ShowcaseView): void {
  clearStage();
  startSeconds = performance.now() / 1000;
  document.querySelector<HTMLElement>('#shot-name')!.textContent = VIEWS.find((v) => v.id === view)!.label;
  document.querySelectorAll<HTMLButtonElement>('#view-controls button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  if (view === 'player') {
    const player = addSoldier('player', [0, 0, 0], 1.1);
    player.root.rotation.y = -0.27;
    setCamera([-6.5, 4.5, 9], [0, 1.78, 0], 5.8);
  } else if (view === 'player-side') {
    const player = addSoldier('player', [-0.3, 0, 0], 1.1);
    const shot = makeShot(player.muzzle!, [0, 0, 0], 1.4);
    muzzle = shot.flash;
    bullet = shot.tracer;
    bullet.position.z = 0.96;
    setCamera([-8.5, 4.1, 4.5], [0, 1.8, 0.5], 5.8);
  } else if (view === 'enemy') {
    addSoldier('enemy', [0, 0, 0], 1.1);
    setCamera([6, 4, 9], [0, 1.75, 0], 5.8);
  } else if (view === 'running') {
    runner = addSoldier('enemy', [0, 0, 0], 1.1);
    setCamera([6, 4, 9], [0, 1.75, 0], 5.8);
  } else if (view === 'boss') {
    boss = addSoldier('enemy', [0, 0, 0], 1, true);
    setCamera([8, 6, 12], [0, 3, 0], 10.2);
  } else if (view === 'projectile') {
    const player = addSoldier('player', [0.45, 0, -1], 0.79);
    const shot = makeShot(player.muzzle!, [0, 0, 0], 1.85);
    muzzle = shot.flash;
    bullet = shot.tracer;
    bullet.position.z = 1.2;
    setCamera([-8, 4.3, 5.4], [0, 1.7, 0.8], 7.5);
  } else if (view === 'death') {
    dying = addSoldier('enemy', [0, 0, 0], 1.08);
    setCamera([6, 4, 9], [0, 2, 0], 6.3);
  } else {
    const player = addSoldier('player', [-1.35, 0, 1.15], 0.68);
    player.root.rotation.y = 1.0;
    const shot = makeShot(player.muzzle!, [0, 0, 0], 1.65);
    muzzle = shot.flash;
    bullet = shot.tracer;
    bullet.position.z = 1.3;
    runner = addSoldier('enemy', [1.42, 0, 1.15], 0.68);
    boss = addSoldier('enemy', [0, 0, -2.3], 0.8, true);
    setCamera([6.5, 7.5, 11.5], [0, 2.5, -0.5], 10.9);
  }
  renderAt(still ? stillTime : 0);
}

function renderAt(seconds: number): void {
  if (runner) poseRunning(runner, seconds);
  if (boss) {
    boss.body.position.y = Math.abs(Math.sin(seconds * 3.2)) * 0.05;
    boss.body.rotation.z = Math.sin(seconds * 3.2) * 0.02;
  }
  if (dying) {
    const pose = deathPose(still ? seconds : seconds % 0.8);
    dying.root.position.y = pose.rise;
    dying.root.rotation.z = Math.sin(seconds * 30) * (1 - pose.gray) * 0.035;
    const seen = new Set<THREE.Material>();
    dying.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mat = object.material;
      if (!(mat instanceof THREE.MeshStandardMaterial) || seen.has(mat)) return;
      seen.add(mat);
      if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
      const original = mat.userData.baseColor as THREE.Color;
      const gray = original.clone();
      const lightness = gray.r * 0.299 + gray.g * 0.587 + gray.b * 0.114;
      gray.setRGB(lightness, lightness, lightness);
      mat.color.copy(original).lerp(gray, pose.gray);
      mat.opacity = pose.opacity;
      mat.depthWrite = true;
    });
  }
  if (muzzle) muzzle.scale.setScalar(0.88 + Math.sin(seconds * 45) * 0.1);
  if (bullet) bullet.position.z = (selected === 'comparison' ? 1.3 : selected === 'projectile' ? 1.2 : 0.96) + (still ? 0 : (seconds * 7) % 2.2);
  renderer.render(scene, camera);
}

const controls = document.querySelector<HTMLElement>('#view-controls')!;
for (const view of VIEWS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.view = view.id;
  button.textContent = view.label;
  button.addEventListener('click', () => {
    selected = view.id;
    const url = new URL(location.href);
    url.searchParams.set('scene', selected);
    url.searchParams.delete('still');
    url.searchParams.delete('t');
    history.replaceState(null, '', url);
    buildView(selected);
  });
  controls.append(button);
}
document.querySelector<HTMLButtonElement>('#save-shot')!.addEventListener('click', () => {
  renderer.render(scene, camera);
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = `topwar-art-${selected}-720x1280.png`;
  anchor.click();
});
buildView(selected);
function animate(): void {
  requestAnimationFrame(animate);
  if (!still) renderAt(performance.now() / 1000 - startSeconds);
}
animate();
