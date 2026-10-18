import type { GameRenderState } from '../rendering/RenderState';

// Authored decoration only: no Simulation, events, RNG, audio or checkpoint state.
export class BattlefieldDiorama {
  readonly state: GameRenderState;

  constructor(base: GameRenderState) {
    this.state = {
      defenseMode: true, player: { ...base.player },
      squad: { ...base.squad, count: 1, rifleCounts: [1], rocketCount: 0, weaponFamily: 'rifle' },
      track: base.track, enemies: [], projectiles: [],
    };
  }

  sample(_ageMs: number): GameRenderState {
    return this.state;
  }
}
