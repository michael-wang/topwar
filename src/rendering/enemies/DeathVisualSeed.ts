import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';
export const DEATH_COMPOSITIONS = 6;
export const deathComposition = (seed:number):number => seed & 7;
const roleIndex = { grunt:0, heavy:1, giant:2 } as const;
export function deathVisualSeed(id:number,role:EnemyDeathRole,sequence:number,salt=0):number {
  const identity=Math.imul(id+1,1597334677)>>>0;
  const hash=(identity^Math.imul(sequence+1,3812015801)^Math.imul(roleIndex[role]+1,2246822519)^Math.imul(salt,3266489917))>>>0;
  const composition=(identity%DEATH_COMPOSITIONS+sequence+salt)%DEATH_COMPOSITIONS;
  return ((hash&0x0ffffff8)|composition)>>>0;
}
// Renderer-owned counters; no simulation RNG or per-death objects.
export class DeathVisualSequence {
  private readonly sequence=new Uint32Array(3);
  private readonly last=new Int8Array(3).fill(-1);
  private salt=0;
  next(id:number,role:EnemyDeathRole):number {
    const index=roleIndex[role],seed=deathVisualSeed(id,role,this.sequence[index]++,this.salt);
    let composition=deathComposition(seed);
    if(composition===this.last[index])composition=(composition+1)%DEATH_COMPOSITIONS;
    this.last[index]=composition;return (seed&~7)|composition;
  }
  reset(visualSalt=0):void {this.salt=visualSalt>>>0;this.sequence.fill(0);this.last.fill(-1);}
}
