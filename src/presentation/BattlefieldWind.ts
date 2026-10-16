// Presentation only. Camera B faces +Z, so render-world -X is screen-right.
// Event size changes plume shape, not the battlefield's wind speed.
export function smokeWindX(ageSeconds:number,dark=false):number {
  return ageSeconds<=0?0:-ageSeconds*(dark?3.4:2.2);
}
