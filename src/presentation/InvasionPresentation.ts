import type { EnemyRenderState, GameRenderState } from '../rendering/RenderState';
import { landingHandoffSeconds, landingSurfZ } from '../app/openingReviewCohort';

type Speeds = { gruntSpeed: number; heavySpeed: number };
/** Render copies of the real DEV cohort; no ticks, RNG, rewards or extra enemies. */
export class InvasionPresentation {
  formationAt = landingHandoffSeconds;
  readonly poseTimes = new Map<number, number>();
  setBriefing(_start: number, end: number): void { this.formationAt = end; }
  readonly state: GameRenderState;
  private readonly visible: EnemyRenderState[] = [];
  private readonly actors: { target: EnemyRenderState; actor: { -readonly [K in keyof EnemyRenderState]: EnemyRenderState[K] }; travel: number; speed: number }[];
  constructor(initial: GameRenderState, speeds: Speeds) {
    this.actors = initial.enemies.map(target => {
      const speed = target.archetype === 'heavy' ? speeds.heavySpeed : speeds.gruntSpeed;
      return { target, actor: { ...target }, speed, travel: (landingSurfZ-target.z)/speed };
    });
    this.state = { ...initial, enemies: this.visible, projectiles: [] };
  }
  sample(seconds: number, _reducedMotion = false): GameRenderState {
    this.visible.length = 0;
    const remaining = Math.max(0, this.formationAt-seconds);
    for (const { target, actor, travel, speed } of this.actors) {
      if (remaining > travel + 1e-9) continue;
      actor.z = target.z + speed*remaining;
      // Phase approaches combat clock zero continuously; reduced motion never teleports troops.
      this.poseTimes.set(actor.id, -remaining*1000);
      this.visible.push(actor);
    }
    return this.state;
  }
}
