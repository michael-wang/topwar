import type { EnemyRenderState, GameRenderState } from '../rendering/RenderState';

// Authored decoration only: no Simulation, events, RNG, audio or checkpoint state.
export class BattlefieldDiorama {
  readonly state: GameRenderState;
  private readonly enemies: { -readonly [K in keyof EnemyRenderState]: EnemyRenderState[K] }[];

  constructor(base: GameRenderState) {
    this.enemies = Array.from({ length: 12 }, (_, i) => ({
      id: 10001 + i, tier: 1, archetype: 'grunt', hp: 10,
      visualScale: .95, x: (i % 4 - 1.5) * 1.15,
      z: 24 + Math.floor(i / 4) * 2.2,
    }));
    this.state = {
      defenseMode: true, player: { x: 0, z: 0, selectedLane: 1 },
      squad: { ...base.squad, count: 3, rifleCounts: [3], rocketCount: 0, weaponFamily: 'rifle' },
      track: base.track, enemies: this.enemies, projectiles: [],
    };
  }

  sample(ageMs: number): GameRenderState {
    // A small seamless sway; distant formations never approach the player.
    const phase = ageMs / 14000 * Math.PI * 2;
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].x = (i % 4 - 1.5) * 1.15 + .08 * Math.sin(phase + i * .6);
    }
    return this.state;
  }
}
