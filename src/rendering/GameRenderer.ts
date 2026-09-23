import * as THREE from 'three';
import { EnemyRenderer } from './enemies/EnemyRenderer';
import { renderSize } from './renderSize';
import type { GameRenderState } from './RenderState';
import { SquadRenderer } from './squad/SquadRenderer';

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly squadRenderer = new SquadRenderer(this.scene);
  private readonly enemyRenderer = new EnemyRenderer(this.scene);
  private readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private readonly road: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private readonly markerGeometry = new THREE.PlaneGeometry(1, 0.08);
  private readonly markerMaterial = new THREE.MeshBasicMaterial({ color: '#edf1e8' });
  private readonly markers: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.viewport.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#a8c4aa');

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: '#80a96d' }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.scene.add(this.ground);

    this.road = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 200),
      new THREE.MeshStandardMaterial({ color: '#d5d9d2' }),
    );
    this.road.rotation.x = -Math.PI / 2;
    this.scene.add(this.road);

    for (let index = 0; index < 20; index++) {
      const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.01;
      this.scene.add(marker);
      this.markers.push(marker);
    }

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2);
    sunlight.position.set(-3, 8, -5);
    this.scene.add(sunlight);

    this.camera.position.set(0, 8, -10);
    this.camera.lookAt(0, 0, 5);
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

  render(state: GameRenderState): void {
    if (this.disposed) return;
    const cameraDistance = Math.max(10, state.track.halfWidth * 4);
    this.camera.position.y = cameraDistance * 0.8;
    this.camera.position.z = state.player.z - cameraDistance;
    this.camera.lookAt(0, 0, state.player.z + cameraDistance * 0.5);
    this.ground.position.z = state.player.z;
    this.road.position.z = state.player.z;
    this.road.scale.x = state.track.halfWidth * 2 + 0.5;
    const firstMarkerZ = Math.floor((state.player.z - 12) / 4) * 4;
    for (let index = 0; index < this.markers.length; index++) {
      const marker = this.markers[index];
      marker.position.z = firstMarkerZ + index * 4;
      marker.scale.x = state.track.halfWidth * 2;
    }
    this.squadRenderer.update(state);
    this.enemyRenderer.update(state.enemies);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopResizeHandling();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.road.geometry.dispose();
    this.road.material.dispose();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.squadRenderer.dispose();
    this.enemyRenderer.dispose();
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
