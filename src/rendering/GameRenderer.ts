import * as THREE from 'three';
import { renderSize } from './renderSize';

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private readonly unit: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.viewport.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#b8c3cb');

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 24),
      new THREE.MeshStandardMaterial({ color: '#a9ada6' }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    this.unit = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.2, 0.9),
      new THREE.MeshStandardMaterial({ color: '#1769ee' }),
    );
    this.unit.position.y = 0.6;
    this.scene.add(this.unit);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2);
    sunlight.position.set(-3, 8, 5);
    this.scene.add(sunlight);

    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0, 0);
    this.resize();
  }

  startResizeHandling(): void {
    if (this.disposed) throw new Error('Cannot start a disposed GameRenderer');
    if (this.resizeObserver) return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  stopResizeHandling(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.resize);
  }

  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopResizeHandling();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.unit.geometry.dispose();
    this.unit.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.disposed = true;
  }

  private readonly resize = (): void => {
    if (this.disposed || this.viewport.clientWidth === 0 || this.viewport.clientHeight === 0) return;
    const size = renderSize(this.viewport.clientWidth, this.viewport.clientHeight);
    this.camera.aspect = size.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size.width, size.height, false);
  };
}
