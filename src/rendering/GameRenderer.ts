import { ART } from '../art/ArtDirection';
import { BattlefieldAir } from './environment/BattlefieldAir';
import type { ProgressionLevelUpEvent } from '../presentation/ProgressionLevelUp';
import * as THREE from 'three';
import { AttackLaneRenderer } from './AttackLaneRenderer';
import { EnemyRenderer } from './enemies/EnemyRenderer';
import { ProjectileRenderer } from './projectiles/ProjectileRenderer';
import { coastalCameraFov, renderSize } from './renderSize';
import type { GameRenderState } from './RenderState';
import { SquadRenderer } from './squad/SquadRenderer';
import { UpgradeGateRenderer } from './gates/UpgradeGateRenderer';
import { UpgradePickupRenderer } from './gates/UpgradePickupRenderer';
import { StreamRewardRenderer } from './rewards/StreamRewardRenderer';
import { BossRenderer } from './boss/BossRenderer';
import { BossCameraFraming } from './boss/BossCameraFraming';
import { BridgeEnvironment } from './environment/BridgeEnvironment';
import { ContactShadowRenderer } from './ContactShadowRenderer';
import type { CharacterAssets } from './CharacterAssets';
import type { PresentationEvent } from '../simulation/PresentationEvent';

export function rendererInfoSnapshot(info: Pick<THREE.WebGLInfo, 'render' | 'memory'>,
  devicePixelRatio: number, rendererPixelRatio: number,
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>) {
  return { drawCalls: info.render.calls, triangles: info.render.triangles,
    geometries: info.memory.geometries, textures: info.memory.textures,
    devicePixelRatio, rendererPixelRatio,
    bufferWidth: canvas.width, bufferHeight: canvas.height };
}

export class GameRenderer {
  getDebugStats() {
    return {
      ...rendererInfoSnapshot(this.renderer.info, window.devicePixelRatio || 1,
        this.renderer.getPixelRatio(), this.renderer.domElement),
      visibleSquad: this.squadRenderer.getVisibleCount(),
      enemies: this.enemyRenderer.getDebugStats(),
      projectiles: this.projectileRenderer.getDebugStats(),
      shadows: this.contactShadows.getDebugStats(),
      environment: this.environment.getDebugStats(),
    };
  }
  private readonly scene = new THREE.Scene();
  private readonly attackLanes = new AttackLaneRenderer(this.scene);
  private readonly camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 180);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly squadRenderer: SquadRenderer;
  private readonly enemyRenderer: EnemyRenderer;
  private readonly bossRenderer: BossRenderer;
  private readonly bossCameraFraming = new BossCameraFraming();
  private readonly projectileRenderer: ProjectileRenderer;
  private readonly gateRenderer = new UpgradeGateRenderer(this.scene);
  private readonly pickupRenderer = new UpgradePickupRenderer(this.scene);
  private readonly streamRewardRenderer: StreamRewardRenderer;
  private readonly environment: BridgeEnvironment;
  private readonly contactShadows: ContactShadowRenderer;
  private readonly air = new BattlefieldAir(this.scene);
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private readonly skyFill = new THREE.HemisphereLight('#c8e0e9', '#bda57e', 1.9);
  private readonly sunlight = new THREE.DirectionalLight('#fff0d4', 1.55);
  private coastalLighting = false;

  constructor(private readonly viewport: HTMLElement, private readonly assets: CharacterAssets) {
    this.squadRenderer = new SquadRenderer(this.scene, assets.families.player);
    this.enemyRenderer = new EnemyRenderer(this.scene, assets.families);
    this.bossRenderer = new BossRenderer(this.scene, assets.families.boss);
    this.streamRewardRenderer = new StreamRewardRenderer(this.scene, assets.rewardHelmet);
    this.projectileRenderer = new ProjectileRenderer(this.scene, assets.bullet, assets.families.player.presentation.tracer);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.viewport.append(this.renderer.domElement);
    this.environment = new BridgeEnvironment(this.scene);
    this.contactShadows = new ContactShadowRenderer(this.scene, assets.families);

    this.sunlight.position.set(-4, 9, -3);
    this.scene.add(this.skyFill, this.sunlight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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
    this.updateCoastalLighting(!!state.defenseMode);
    this.bossCameraFraming.update(this.camera, state.boss, state.player.z, nowMs);
    this.air.update(state.enemies, state.player.z, nowMs, !!state.defenseMode);
    this.environment.update(state.player.z, state.track.halfWidth, nowMs, state.defenseMode, state.landingAssaultAgeSeconds);
    this.attackLanes.update(state.track.lanePositions, state.player.z, state.player.x, state.defenseMode);
    this.squadRenderer.update(state, nowMs);
    this.enemyRenderer.update(state.enemies, nowMs);
    this.bossRenderer.update(state.boss, nowMs, state.player.z);
    this.streamRewardRenderer.update(state.streamRewards, nowMs);
    this.contactShadows.update(state, this.squadRenderer, nowMs);
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

  presentLevelUp(event: ProgressionLevelUpEvent, nowMs: number): void {
    this.squadRenderer.presentLevelUp(event, nowMs);
    this.projectileRenderer.presentLevelUp(nowMs);
  }

  resetFeedback(): void {
    this.air.reset();
    this.squadRenderer.reset();
    this.enemyRenderer.reset();
    this.bossRenderer.reset();
    this.bossCameraFraming.reset();
    this.streamRewardRenderer.reset();
    this.contactShadows.reset();
    this.projectileRenderer.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopResizeHandling();
    this.air.dispose();
    this.environment.dispose();
    this.attackLanes.dispose();
    this.contactShadows.dispose();
    this.squadRenderer.dispose();
    this.enemyRenderer.dispose();
    this.bossRenderer.dispose();
    this.bossCameraFraming.reset();
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

  private updateCoastalLighting(defense: boolean): void {
    if (defense === this.coastalLighting) return;
    this.coastalLighting = defense;
    const light = ART.coastalDefense.lighting;
    this.skyFill.color.set(defense ? light.sky : '#c8e0e9');
    this.skyFill.groundColor.set(defense ? light.ground : '#bda57e');
    this.skyFill.intensity = defense ? light.hemisphereIntensity : 1.9;
    this.sunlight.color.set(defense ? light.sun : '#fff0d4');
    this.sunlight.intensity = defense ? light.sunIntensity : 1.55;
    if (defense) this.sunlight.position.set(...light.sunPosition);
    else this.sunlight.position.set(-4, 9, -3);
    // Defense-specific filmic highlight rolloff; legacy bridge retains its previous output.
    this.renderer.toneMapping = defense ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = defense ? light.exposure : 1;
    this.resize();
  }

  private readonly resize = (): void => {
    if (this.disposed || this.viewport.clientWidth === 0 || this.viewport.clientHeight === 0) return;
    const size = renderSize(this.viewport.clientWidth, this.viewport.clientHeight);
    this.camera.aspect = size.aspect;
    this.camera.fov = this.coastalLighting ? coastalCameraFov(size.aspect) : 48;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size.width, size.height, false);
  };
}
