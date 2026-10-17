import { SupportAirstrikeRenderer } from './SupportAirstrikeRenderer';
import { applyCoastalCamera } from './CoastalCamera';
import type { SupportEvent } from '../simulation/commanderSupport';
import { ART } from '../art/ArtDirection';
import { IdlePreparation } from '../presentation/IdlePreparation';
import { GrenadeRenderer } from './GrenadeRenderer';
import { EnemyArtilleryRenderer } from './EnemyArtilleryRenderer';
import { DestroyerRenderer } from './DestroyerRenderer';
import { DefenseTankRenderer } from './DefenseTankRenderer';
import type { TankEntranceEvent } from '../simulation/defenseTank';
import type { ArtilleryEvent } from '../simulation/artillery';
import type { GrenadeEvent } from '../simulation/grenade';
import { BattlefieldAir } from './environment/BattlefieldAir';
import type { ProgressionLevelUpEvent } from '../presentation/ProgressionLevelUp';
import * as THREE from 'three';
import { AttackLaneRenderer } from './AttackLaneRenderer';
import { BattlefieldLaneHighlights } from './BattlefieldLaneHighlights';
import { EnemyRenderer } from './enemies/EnemyRenderer';
import { ProjectileRenderer } from './projectiles/ProjectileRenderer';
import { renderSize } from './renderSize';
import type { GameRenderState } from './RenderState';
import { SquadRenderer } from './squad/SquadRenderer';
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
  private readonly tankHealthVector = new THREE.Vector3();
  private readonly tankHealthPoint = { x: 0, y: 0 };
  getDebugStats() {
    return {
      ...rendererInfoSnapshot(this.renderer.info, window.devicePixelRatio || 1,
        this.renderer.getPixelRatio(), this.renderer.domElement),
      visibleSquad: this.squadRenderer.getVisibleCount(),
      enemies: this.enemyRenderer.getDebugStats(),
      projectiles: this.projectileRenderer.getDebugStats(),
      grenade: this.grenadeRenderer.getDebugStats(),
      artillery: this.artilleryRenderer?.getDebugStats() ?? { capacity: 0, shells: 0, warnings: 0, impacts: 0 },
      shadows: this.contactShadows.getDebugStats(),
      environment: this.environment.getDebugStats(),
    };
  }
  private readonly scene = new THREE.Scene();
  private readonly grenadeRenderer = new GrenadeRenderer(this.scene);
  private artilleryRenderer: EnemyArtilleryRenderer | null = null;
  private destroyerRenderer: DestroyerRenderer | null = null;
  private supportRenderer: SupportAirstrikeRenderer | null = null;
  private tankRenderer: DefenseTankRenderer | null = null;
  private readonly attackLanes = new AttackLaneRenderer(this.scene);
  private readonly laneHighlights = new BattlefieldLaneHighlights(this.scene);
  private readonly camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 180);
  private viewportCssHeight = 1;
  private readonly supplyProjection = new THREE.Vector3();
  private readonly playerWarningPoint = { x: 0, y: 0 };
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly squadRenderer: SquadRenderer;
  private readonly enemyRenderer: EnemyRenderer;
  private readonly projectileRenderer: ProjectileRenderer;
  private readonly environment: BridgeEnvironment;
  private readonly contactShadows: ContactShadowRenderer;
  private readonly air = new BattlefieldAir(this.scene);
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private preparation: IdlePreparation | null = null;
  private readonly skyFill = new THREE.HemisphereLight('#c8e0e9', '#bda57e', 1.9);
  private readonly sunlight = new THREE.DirectionalLight('#fff0d4', 1.55);
  private coastalLighting = true;

  constructor(private readonly viewport: HTMLElement, private readonly assets: CharacterAssets) {
    this.squadRenderer = new SquadRenderer(this.scene, assets.families.player);
    this.enemyRenderer = new EnemyRenderer(this.scene, assets.families);
    this.projectileRenderer = new ProjectileRenderer(this.scene, assets.families.player.presentation.tracer);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.viewport.append(this.renderer.domElement);
    this.environment = new BridgeEnvironment(this.scene);
    this.contactShadows = new ContactShadowRenderer(this.scene, assets.families);

    this.configureCoastalLighting();
    this.scene.add(this.skyFill, this.sunlight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    applyCoastalCamera(this.camera);
    this.resize();
    this.renderer.domElement.addEventListener('webglcontextrestored', this.restartPreparation);
    this.renderer.domElement.addEventListener('webglcontextlost', this.suspendPreparation);
  }

  preparePresentation(): void {
    if (!this.disposed && !this.preparation) this.preparation = new IdlePreparation(this.preparationSteps());
  }
  private readonly restartPreparation = (): void => {
    if (!this.preparation) return;
    this.preparation.dispose(); this.preparation = null; this.preparePresentation();
  };
  private readonly suspendPreparation = (): void => { this.preparation?.dispose(); };
  private *preparationSteps(): Generator<unknown> {
    // Submit programs without querying synchronous shader diagnostics. Each idle
    // step handles one material layout; there are no uncancellable polling promises.
    for (const object of this.environment.preparationObjects())
      yield* this.prepareObject(object);
    for (const mesh of this.grenadeRenderer.preparationMeshes())
      yield* this.prepareObject(mesh);
    // These resources are used by Stage 1, but neither construction nor compilation
    // belongs in Tap-to-Start or in the first incoming shell/Destroyer render.
    if (this.coastalLighting) {
      this.destroyerRenderer ??= new DestroyerRenderer(this.scene); yield;
      this.artilleryRenderer ??= new EnemyArtilleryRenderer(this.scene); yield;
      this.tankRenderer ??= new DefenseTankRenderer(this.scene); yield;
    }
    if (!this.renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const seen = new Set<string>();
    function* objects(root: THREE.Object3D): Generator<THREE.Object3D> {
      for (const child of root.children) { yield child; yield* objects(child); }
    }
    for (const object of objects(this.scene)) {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite) || !object.layers.test(this.camera.layers)) continue;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Distinct materials and instancing/color layouts need distinct preparation.
      const key = materials.map(m => m.uuid).join(',') + ':' + (object instanceof THREE.InstancedMesh ? `instances:${!!object.instanceColor}` : 'single');
      if (seen.has(key)) continue;
      seen.add(key);
      yield* this.prepareObject(object);
    }
  }
  private *prepareObject(object: THREE.Object3D): Generator<void> {
    // Submission alone did not reduce first-use stalls on drivers without
    // nonblocking completion support. Avoid speculative GPU work on those devices.
    if (!this.renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const materials = this.renderer.compile(object, this.camera, this.scene);
    yield;
    // Three r180 compileAsync polls these same programs, but its internal timer
    // cannot be cancelled on disposal/context loss. Keep polling in our owned queue.
    const programs = new Set([...materials].map(material => (this.renderer.properties.get(material) as {
      currentProgram: { isReady(): boolean; getUniforms(): unknown };
    }).currentProgram));
    const deadline = performance.now() + 5000;
    for (const program of programs) {
      while (!program.isReady()) {
        if (performance.now() >= deadline) return;
        yield;
      }
      program.getUniforms();
      yield;
    }
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

  // Uses the same renderer/pools, without weapons, warning or combat FX passes.
  renderDiorama(state: GameRenderState, nowMs: number): void {
    if (this.disposed) return;
    this.environment.update(state.player.z, state.track.halfWidth, nowMs);
    this.squadRenderer.updateIdle(state, nowMs);
    this.enemyRenderer.update(state.enemies, nowMs, true, 0, 0);
    this.contactShadows.update(state, this.squadRenderer, nowMs);
    this.renderer.render(this.scene, this.camera);
  }

  render(state: GameRenderState, nowMs = performance.now()): void {
    if (this.disposed) return;
    this.air.update(state.enemies, nowMs, !!state.defenseMode);
    this.environment.update(state.player.z, state.track.halfWidth, nowMs);
    this.attackLanes.update(state.track.lanePositions, state.player.z);
    this.laneHighlights.update(state);
    this.squadRenderer.update(state, nowMs);
    this.enemyRenderer.update(state.enemies, nowMs, !!state.defenseMode, -state.player.x, state.player.z);
    this.contactShadows.update(state, this.squadRenderer, nowMs);
    this.projectileRenderer.update(state.projectiles, nowMs, this.camera,
      this.viewportCssHeight);
    this.grenadeRenderer.update(state.grenade, nowMs);
    if (state.destroyer && (state.destroyer.state.status === 'active' || state.destroyer.presence && state.destroyer.presence.status !== 'absent'))
      this.destroyerRenderer ??= new DestroyerRenderer(this.scene);
    this.destroyerRenderer?.update(state.destroyer, nowMs);
    if (state.defenseTank) this.tankRenderer ??= new DefenseTankRenderer(this.scene);
    this.tankRenderer?.update(state.defenseTank, nowMs);
    if (state.defenseTank) for (const shell of state.artillery?.shells ?? [])
      if (shell.source.type === 'defenseTank') this.tankRenderer?.recoil(shell.launchedAtSeconds, state.defenseTank.elapsedSeconds);
    if (state.artillery) this.artilleryRenderer ??= new EnemyArtilleryRenderer(this.scene);
    if (state.commanderSupport?.state.airstrike?.triggeredAtSeconds !== null && state.commanderSupport?.state.airstrike?.triggeredAtSeconds !== undefined)
      this.supportRenderer ??= new SupportAirstrikeRenderer(this.scene);
    const shake = this.supportRenderer?.update(nowMs, state) ?? 0;
    this.camera.position.x += shake;
    this.artilleryRenderer?.update(state.artillery, nowMs, state.player, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.x -= shake;
  }

  present(events: readonly PresentationEvent[], nowMs: number,
    trackHalfWidth: number, formationSpacing: number, defenseFormation?: GameRenderState['squad']['defenseFormation'], laneEdgeX?: number): void {
    this.squadRenderer.present(events, nowMs, trackHalfWidth, formationSpacing, defenseFormation, laneEdgeX);
    this.enemyRenderer.present(events, nowMs);
  }

  presentArtillery(events: readonly ArtilleryEvent[], nowMs: number): void {
    if (!events.length) return;
    this.artilleryRenderer ??= new EnemyArtilleryRenderer(this.scene);
    this.artilleryRenderer.present(events, nowMs);
    for(const event of events)if(event.kind==='artilleryLaunch'){
      if(event.shell.source.type==='defenseTank'){
        this.tankRenderer??=new DefenseTankRenderer(this.scene);
        this.tankRenderer.presentCannon(event.shell.launchedAtSeconds,nowMs);
      }else if(event.shell.source.type==='destroyer'){
        this.destroyerRenderer??=new DestroyerRenderer(this.scene);
        this.destroyerRenderer.presentCannon(event.shell.launchedAtSeconds,nowMs);
      }
    }
  }

  presentGrenade(events: readonly GrenadeEvent[], nowMs: number): void {
    this.grenadeRenderer.present(events, nowMs);
    this.enemyRenderer.presentGrenade(events, nowMs);
    this.tankRenderer?.presentGrenade(events, nowMs);
  }

  projectSupplyPosition(x: number, z: number, nowMs: number): { x: number; y: number } {
    this.supplyProjection.set(-x,.9+.07*Math.sin(nowMs/220),z).project(this.camera);
    return {x:(this.supplyProjection.x+1)*this.viewport.clientWidth/2,
      y:(1-this.supplyProjection.y)*this.viewport.clientHeight/2};
  }
  projectTankHealthPosition(): { x: number; y: number } | null {
    if (!this.tankRenderer?.group.visible) return null;
    this.tankRenderer.healthBarPosition(this.tankHealthVector).project(this.camera);
    if (Math.abs(this.tankHealthVector.z) > 1) return null;
    this.tankHealthPoint.x = (this.tankHealthVector.x + 1) * this.viewport.clientWidth / 2;
    this.tankHealthPoint.y = (1 - this.tankHealthVector.y) * this.viewport.clientHeight / 2;
    return this.tankHealthPoint;
  }
  projectPlayerWarningPosition(x: number): { x: number; y: number } {
    this.supplyProjection.set(-x, 1.45, 0).project(this.camera);
    this.playerWarningPoint.x = (this.supplyProjection.x + 1) * this.viewport.clientWidth / 2;
    this.playerWarningPoint.y = (1 - this.supplyProjection.y) * this.viewport.clientHeight / 2;
    return this.playerWarningPoint;
  }
  presentSupport(events: readonly SupportEvent[], nowMs: number): void {
    if (!events.length) return;
    this.supportRenderer ??= new SupportAirstrikeRenderer(this.scene);
    this.supportRenderer.present(events, nowMs);
    for (const event of events) if (event.kind === 'supportBomb')
      this.enemyRenderer.presentSupportBomb(event, nowMs);
    this.tankRenderer?.presentSupport(events, nowMs);
  }

  presentTankEntrance(events: readonly TankEntranceEvent[], nowMs: number): void {
    if (!events.length) return;
    this.tankRenderer ??= new DefenseTankRenderer(this.scene);
    for (const event of events) {
      this.tankRenderer.presentEntrance(event, nowMs);
      this.enemyRenderer.presentTankEntrance(event, nowMs);
    }
  }

  presentLevelUp(event: ProgressionLevelUpEvent, nowMs: number): void {
    this.squadRenderer.presentLevelUp(event, nowMs);
  }

  restoreFeedback(state: GameRenderState, nowMs: number, victoryElapsedMs?: number): void {
    this.resetFeedback();
    if (state.defenseTank) { this.tankRenderer ??= new DefenseTankRenderer(this.scene); this.tankRenderer.restore(state.defenseTank, nowMs, victoryElapsedMs); }
    if(state.artillery){this.artilleryRenderer ??= new EnemyArtilleryRenderer(this.scene);this.artilleryRenderer.restore(state.artillery);}
    // Prime existing identities before the first paused draw; no hit/death replay.
    this.enemyRenderer.update(state.enemies, nowMs, !!state.defenseMode,
      -state.player.x, state.player.z);
  }

  resetFeedback(visualSalt=0): void {
    this.laneHighlights.reset();
    this.air.reset();
    this.grenadeRenderer.reset();
    this.artilleryRenderer?.reset();
    this.destroyerRenderer?.reset();
    this.tankRenderer?.reset();
    this.supportRenderer?.reset();
    this.squadRenderer.reset();
    this.enemyRenderer.reset(visualSalt);
    this.contactShadows.reset();
    this.projectileRenderer.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.preparation?.dispose(); this.preparation = null;
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.restartPreparation);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.suspendPreparation);
    this.stopResizeHandling();
    this.air.dispose();
    this.grenadeRenderer.dispose();
    this.artilleryRenderer?.dispose();
    this.destroyerRenderer?.dispose();
    this.tankRenderer?.dispose();
    this.supportRenderer?.dispose();
    this.environment.dispose();
    this.attackLanes.dispose();
    this.laneHighlights.dispose();
    this.contactShadows.dispose();
    this.squadRenderer.dispose();
    this.enemyRenderer.dispose();
    this.projectileRenderer.dispose();
    this.assets.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.disposed = true;
  }

  private configureCoastalLighting(): void {
    const light = ART.coastalDefense.lighting;
    this.skyFill.color.set(light.sky); this.skyFill.groundColor.set(light.ground);
    this.skyFill.intensity = light.hemisphereIntensity;
    this.sunlight.color.set(light.sun); this.sunlight.intensity = light.sunIntensity;
    this.sunlight.position.set(...light.sunPosition);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = light.exposure;
  }

  private readonly resize = (): void => {
    if (this.disposed || this.viewport.clientWidth === 0 || this.viewport.clientHeight === 0) return;
    const size = renderSize(this.viewport.clientWidth, this.viewport.clientHeight);
    this.viewportCssHeight = size.height;
    this.camera.aspect = size.aspect;
    applyCoastalCamera(this.camera);
    this.renderer.setSize(size.width, size.height, false);
  };
}
