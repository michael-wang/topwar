import * as THREE from 'three';
import { EnemyRenderer } from './enemies/EnemyRenderer';
import { ProjectileRenderer } from './projectiles/ProjectileRenderer';
import { renderSize } from './renderSize';
import type { GameRenderState } from './RenderState';
import { SquadRenderer } from './squad/SquadRenderer';
import { UpgradeGateRenderer } from './gates/UpgradeGateRenderer';
import { UpgradePickupRenderer } from './gates/UpgradePickupRenderer';
import { StreamRewardRenderer } from './rewards/StreamRewardRenderer';
import { BossRenderer } from './boss/BossRenderer';
import type { CharacterAssets } from './CharacterAssets';
import type { PresentationEvent } from '../simulation/PresentationEvent';

export class GameRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly squadRenderer: SquadRenderer;
  private readonly enemyRenderer: EnemyRenderer;
  private readonly bossRenderer: BossRenderer;
  private readonly projectileRenderer: ProjectileRenderer;
  private readonly gateRenderer = new UpgradeGateRenderer(this.scene);
  private readonly pickupRenderer = new UpgradePickupRenderer(this.scene);
  private readonly streamRewardRenderer: StreamRewardRenderer;
  private readonly ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private readonly road: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(private readonly viewport: HTMLElement, private readonly assets: CharacterAssets) {
    this.squadRenderer = new SquadRenderer(this.scene, assets.playerBody, assets.helmet, assets.vest, assets.rifle);
    this.enemyRenderer = new EnemyRenderer(this.scene, assets.body, assets.helmet,
      assets.vest, assets.runFrames, assets.grayBody);
    this.bossRenderer = new BossRenderer(this.scene, assets.body, assets.helmet, assets.bossVest,
      assets.bossSlamFrames);
    this.streamRewardRenderer = new StreamRewardRenderer(this.scene, assets.helmet);
    this.projectileRenderer = new ProjectileRenderer(this.scene, assets.bullet);
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

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2);
    sunlight.position.set(-3, 8, -5);
    this.scene.add(sunlight);

    this.camera.position.set(0, 6.5, -10);
    this.camera.lookAt(0, 0, 12.5);
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

  render(state: GameRenderState, nowMs = performance.now()): void {
    if (this.disposed) return;
    const cameraDistance = 10;
    this.camera.position.y = 6.5;
    this.camera.position.z = state.player.z - cameraDistance;
    this.camera.lookAt(0, 0, state.player.z + 12.5);
    this.ground.position.z = state.player.z;
    this.road.position.z = state.player.z;
    this.road.scale.x = state.track.halfWidth * 2 + 0.5;
    this.squadRenderer.update(state, nowMs);
    this.enemyRenderer.update(state.enemies, nowMs);
    this.bossRenderer.update(state.boss, nowMs);
    this.streamRewardRenderer.update(state.streamRewards, nowMs);
    this.projectileRenderer.update(state.projectiles, nowMs);
    this.gateRenderer.update(state.gates);
    this.pickupRenderer.update(state.pickups);
    this.renderer.render(this.scene, this.camera);
  }

  present(events: readonly PresentationEvent[], nowMs: number,
    trackHalfWidth: number, formationSpacing: number): void {
    this.squadRenderer.present(events, nowMs, trackHalfWidth, formationSpacing);
    this.enemyRenderer.present(events, nowMs);
  }

  resetFeedback(): void {
    this.squadRenderer.reset();
    this.enemyRenderer.reset();
    this.bossRenderer.reset();
    this.streamRewardRenderer.reset();
    this.projectileRenderer.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopResizeHandling();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.road.geometry.dispose();
    this.road.material.dispose();
    this.squadRenderer.dispose();
    this.enemyRenderer.dispose();
    this.bossRenderer.dispose();
    this.projectileRenderer.dispose();
    this.gateRenderer.dispose();
    this.pickupRenderer.dispose();
    this.streamRewardRenderer.dispose();
    this.assets.dispose();
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
