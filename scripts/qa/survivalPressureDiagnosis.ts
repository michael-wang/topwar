import type { EnemySimulationState, SimulationState } from '../../src/simulation/SimulationState';
import { SurvivalDiagnosis } from './survivalDiagnosis';

// Offline review extension. The private SSR transform is the only caller of its hooks.
export class SurvivalPressureDiagnosis extends SurvivalDiagnosis {
  private current?: SimulationState;
  private readonly engagement = new Map<number, { at: number; level: number; xp: number }>();
  private readonly upgrades: { level: number; at: number; windows: ReturnType<SurvivalPressureDiagnosis['pressure']>[] }[] = [];
  begin(state: SimulationState, dt = 1 / 60): void { super.begin(state, dt); this.current = state; }
  hit(enemy: EnemySimulationState, damage: number, cause: string): void {
    super.hit(enemy, damage, cause);
    if (!this.engagement.has(enemy.id) && this.current) this.engagement.set(enemy.id, {
      at: this.current.elapsedSeconds + 1 / 60, level: this.current.progression!.level, xp: this.current.progression!.xp,
    });
  }
  private pressure(s: SimulationState, offset: number) {
    const cohorts = new Map<number, { id: number; count: number; hp: number }>();
    for (const e of s.enemies) {
      const id = this.enemies.get(e.id)!.cohort, row = cohorts.get(id) ?? { id, count: 0, hp: 0 };
      row.count++; row.hp += e.hp; cohorts.set(id, row);
    }
    return { offset, at: s.elapsedSeconds, level: s.progression!.level, soldiers: s.squad.count,
      active: s.enemies.length, hp: s.enemies.reduce((n,e) => n+e.hp,0),
      near: [30,20,10].map(z => s.enemies.filter(e=>e.z-s.player.z<=z).length), cohorts: [...cohorts.values()] };
  }
  end(state: SimulationState, before: SimulationState, presentation: { kind: string; [key: string]: unknown }[]): void {
    super.end(state, before, presentation);
    for (const level of [9,10]) if (before.progression!.level < level && state.progression!.level >= level)
      this.upgrades.push({ level, at: state.elapsedSeconds, windows: [this.pressure(before,-1/60), this.pressure(state,0)] });
    for (const u of this.upgrades) for (const offset of [5,10,20])
      if (state.elapsedSeconds+1e-9>=u.at+offset && !u.windows.some(w=>w.offset===offset)) u.windows.push(this.pressure(state,offset));
  }
  finish(state: SimulationState) {
    const result = super.finish(state);
    return { ...result, upgrades: this.upgrades.map(u=>({ ...u, censoredOffsets: [5,10,20].filter(t=>!u.windows.some(w=>w.offset===t)) })),
      engagements: [...this.engagement].map(([id,firstHit])=>({id,cohort:this.enemies.get(id)!.cohort,...firstHit})) };
  }
}
