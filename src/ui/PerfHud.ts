import type { PerfDiagnostics } from '../app/PerfDiagnostics';
import type { GameRenderer } from '../rendering/GameRenderer';
import type { GameAudio } from '../audio/GameAudio';

const compact = (value: number): string => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

export class PerfHud {
  private readonly element: HTMLElement;
  private lastUpdateMs = -Infinity;

  constructor(viewport: HTMLElement) {
    this.element = document.createElement('pre');
    this.element.className = 'perf-hud';
    this.element.setAttribute('aria-label', 'Performance diagnostics');
    viewport.append(this.element);
  }

  update(nowMs: number, metrics: PerfDiagnostics, renderer: GameRenderer, audio: GameAudio,
    game: { enemies: number; projectiles: number; rewards: number; boss: boolean;
      tier: number; playerZ: number }): void {
    if (nowMs - this.lastUpdateMs < 250) return;
    this.lastUpdateMs = nowMs;
    const r = renderer.getDebugStats();
    const a = audio.getDebugStats();
    const h = metrics.highWater;
    const c = metrics.counters;
    const caps = (values: readonly number[]) => values.join('/');
    this.element.textContent = [
      `PERF  T${game.tier} Z${game.playerZ.toFixed(0)}`,
      `FPS ${metrics.frame.average() ? (1000 / metrics.frame.average()).toFixed(0) : '0'}  avg ${metrics.frame.average().toFixed(1)} p95 ${metrics.frame.p95().toFixed(1)}ms`,
      `SIM ${metrics.sim.average().toFixed(1)} RND ${metrics.render.average().toFixed(1)} AUD ${metrics.audio.average().toFixed(1)}ms`,
      `CPU step ${metrics.stepCpu.average().toFixed(1)} state ${metrics.stateCpu.average().toFixed(1)} map ${metrics.mapCpu.average().toFixed(1)}`,
      `STEP ${metrics.currentSteps} avg ${metrics.steps.average().toFixed(1)} max ${metrics.maxSteps}`,
      `E ${game.enemies}/${h.enemies} P ${game.projectiles}/${h.projectiles}`,
      `S ${r.visibleSquad} RW ${game.rewards} B ${game.boss ? 'Y' : 'N'}`,
      `HIT calls ${compact(c.findFirstHitCalls)} checks ${compact(c.enemyCandidateChecks)}`,
      `H avg calls ${compact(Math.round(metrics.collisionCalls.average()))} chk ${compact(Math.round(metrics.collision.average()))}`,
      `PASS ${compact(c.projectilePasses)} pen ${compact(c.penetrationPasses)}`,
      `P avg ${compact(Math.round(metrics.projectilePasses.average()))} pen ${compact(Math.round(metrics.penetrationPasses.average()))}`,
      `DRAW ${r.drawCalls}/${h.drawCalls} TRI ${compact(r.triangles)}/${compact(h.triangles)}`,
      `GEO ${r.geometries} TEX ${r.textures}`,
      `DPR ${r.devicePixelRatio.toFixed(1)}→${r.rendererPixelRatio.toFixed(1)} ${r.bufferWidth}x${r.bufferHeight}`,
      `P pool ${r.projectiles.pool}/${h.projectilePool} pulse ${r.projectiles.pulseTrackers}`,
      `E body ${caps(r.enemies.bodyCapacities)}`,
      `E helm/vest ${caps(r.enemies.tierCapacities)}`,
      `E death ${r.enemies.deathVisuals} contact ${r.enemies.contactVisuals}`,
      `SH P${r.shadows.player.active}/${r.shadows.player.capacity} E${r.shadows.enemy.active}/${r.shadows.enemy.capacity}`,
      `SH B${r.shadows.boss.active}/${r.shadows.boss.capacity} R${r.shadows.reward.active}/${r.shadows.reward.capacity}`,
      `ENV sm${r.environment.smoke} in${r.environment.infernoSources}`,
      `ENV imp${r.environment.activeImpacts}/${r.environment.impactSlots} fl${r.environment.activeFlak}/${r.environment.flakSlots}`,
      `ENV air${r.environment.activeAircraft}/${r.environment.aircraft} ship${r.environment.shipSections}`,
      `AUD music ${a.musicVoices} sfx ${a.sfxSources}`,
    ].join('\n');
  }

  reset(): void { this.lastUpdateMs = -Infinity; }
  dispose(): void { this.element.remove(); }
}
