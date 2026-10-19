import type { EnemyRenderState, GameRenderState } from '../rendering/RenderState';

type Speeds = { gruntSpeed: number; heavySpeed: number };
/** Disposable render copies of T=0; never owns a Simulation, RNG or checkpoint. */
export class InvasionPresentation {
  private firstArrival = 5.1;
  formationAt = 11.074;
  readonly poseTimes = new Map<number, number>();
  setBriefing(start: number, end: number): void {
    this.firstArrival = Math.max(5.1, start + 2);
    this.formationAt = end - .35;
  }
  readonly state: GameRenderState;
  private readonly visible: EnemyRenderState[] = [];
  private readonly actors: { target: EnemyRenderState; actor: { -readonly [K in keyof EnemyRenderState]: EnemyRenderState[K] }; at: number; walks: boolean; speed: number }[];
  constructor(initial: GameRenderState, speeds: Speeds) {
    const speed = (e: EnemyRenderState) => e.archetype === 'heavy' ? speeds.heavySpeed : speeds.gruntSpeed;
    // Pick real near-surf destinations reachable even by the sixth arrival.
    // Far-inland ranks assemble in place; they never sprint to meet a deadline.
    const reachable = initial.enemies.filter(e => e.z <= 45.5).sort((a,b)=>a.z-b.z || a.id-b.id);
    const pioneers: EnemyRenderState[] = [];
    for(let i=0;i<6;i++) {
      const available = this.formationAt-this.firstArrival-i*.35-.15;
      const eligible = reachable.filter(e=>!pioneers.includes(e) && 45.5-e.z<=speed(e)*available);
      const sector = (e: EnemyRenderState) => e.x<-.65?0:e.x>.65?2:1;
      const next = eligible.find(e=>sector(e)===i%3) ?? eligible[0];
      if(next)pioneers.push(next);
    }
    const ids = new Set(pioneers.map(e=>e.id));
    const ordered = [...pioneers, ...initial.enemies.filter(e=>!ids.has(e.id)).sort((a,b)=>b.z-a.z || a.id-b.id)];
    this.actors = ordered.map((target,i) => ({ target, actor: { ...target }, walks: i<pioneers.length, speed: speed(target),
      at: i < pioneers.length ? i * .35 : 1.9 + ((i-pioneers.length)/Math.max(1,ordered.length-pioneers.length-1)) ** .65 }));
    this.state = { ...initial, enemies: this.visible, projectiles: [] };
  }
  sample(seconds: number, reducedMotion = false): GameRenderState {
    this.visible.length = 0;
    for (const { target, actor, at: admission, walks, speed } of this.actors) {
      const at = this.firstArrival + (walks ? admission : 1.9 + (admission-1.9) * (this.formationAt-this.firstArrival-2.7));
      if(seconds < at) continue;
      const elapsed = seconds-at;
      actor.x = target.x;
      actor.z = walks && !reducedMotion ? Math.max(target.z, 45.5-speed*elapsed) : target.z;
      this.poseTimes.set(actor.id, actor.z > target.z ? elapsed*1000 : 0);
      this.visible.push(actor);
    }
    return this.state;
  }
}
