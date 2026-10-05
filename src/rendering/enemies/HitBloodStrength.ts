import type { BloodSplatTiming, EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const HIT_BLOOD_CAPACITY = 128;
export const HIT_BLOOD_REFERENCE_SCALE = { grunt:1, heavy:1.45, giant:2.2 } as const;
export const HIT_BLOOD_TIMING:Record<EnemyDeathRole,BloodSplatTiming> = {
  grunt:{bloodStartMs:0,bloodEndMs:135,bloodPulseCount:1,bloodScale:HIT_BLOOD_REFERENCE_SCALE.grunt},
  heavy:{bloodStartMs:0,bloodEndMs:135,bloodPulseCount:1,bloodScale:HIT_BLOOD_REFERENCE_SCALE.heavy},
  giant:{bloodStartMs:0,bloodEndMs:135,bloodPulseCount:1,bloodScale:HIT_BLOOD_REFERENCE_SCALE.giant},
};
// A perceptual floor keeps chip damage readable; the cap keeps a surviving hit
// below a kill. Actual observed damage/max HP, never a role-specific fake HP.
export function hitBloodRelativeScale(damageTaken:number,maxHp:number):number {
  if(damageTaken<=0||maxHp<=0)return 0;
  const fraction=Math.min(1,damageTaken/maxHp);
  return Math.min(.40,Math.max(.07,.055+.58*Math.sqrt(fraction)));
}
export const hitBloodScale=(role:EnemyDeathRole,damageTaken:number,maxHp:number):number =>
  HIT_BLOOD_REFERENCE_SCALE[role]*hitBloodRelativeScale(damageTaken,maxHp);
