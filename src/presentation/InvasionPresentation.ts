import type { EnemyRenderState, GameRenderState } from '../rendering/RenderState';

/** Disposable render copies of T=0; never owns a Simulation, RNG or checkpoint. */
export class InvasionPresentation {
  readonly state: GameRenderState;
  private readonly visible: EnemyRenderState[] = [];
  private readonly actors: { target: EnemyRenderState; actor: { -readonly [K in keyof EnemyRenderState]: EnemyRenderState[K] }; at: number; entryX: number }[];
  constructor(initial: GameRenderState) {
    // Front ranks travel first and furthest. Every identity gets one appearance.
    const frontFirst = [...initial.enemies].sort((a, b) => a.z - b.z || a.id - b.id);
    const directions = [frontFirst.filter(e => e.x < -.65), frontFirst.filter(e => Math.abs(e.x) <= .65), frontFirst.filter(e => e.x > .65)];
    const ordered: EnemyRenderState[] = [];
    for (let row = 0; row < Math.max(...directions.map(group => group.length)); row++)
      for (const group of directions) if (group[row]) ordered.push(group[row]);
    this.actors = ordered.map((target, i) => ({ target, actor: { ...target },
      at: i < 6 ? 2.2 + i * .55 : 5.4 + 3.2 * ((i - 6) / Math.max(1, ordered.length - 7)) ** .65,
      entryX: target.x < -.65 ? -3 : target.x > .65 ? 3 : 0 }));
    this.state = { ...initial, enemies: this.visible, projectiles: [] };
  }
  sample(seconds: number, reducedMotion = false): GameRenderState {
    this.visible.length = 0;
    for (const { target, actor, at, entryX } of this.actors) {
      if (seconds < at) continue;
      const fraction = Math.min(1, Math.max(0, (seconds - at) / (10.9 - at)));
      // Reduced motion uses quiet stepped tableaux instead of a rushing sweep.
      const t = reducedMotion ? Math.floor(fraction * 4) / 4 : fraction;
      actor.x = t === 1 ? target.x : entryX + (target.x - entryX) * t;
      actor.z = t === 1 ? target.z : 45.5 + (target.z - 45.5) * t;
      this.visible.push(actor);
    }
    return this.state;
  }
}
