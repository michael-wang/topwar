// The level seed is a stable salt; the run seed changes the layout without
// mutating authored data. All operations are explicitly unsigned 32-bit.
export function effectiveSeed(runSeed: number, authoredSeed: number): number {
  let value = (runSeed ^ authoredSeed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}
