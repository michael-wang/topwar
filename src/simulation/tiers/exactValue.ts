// Large exchange values are strings in snapshots, so SimulationState remains JSON data.
export type ExactValue = number | string;

export function readExactValue(value: unknown, label: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  throw new Error(`${label} must be an exact non-negative integer`);
}

export function storeExactValue(value: bigint): ExactValue {
  if (value < 0n) throw new Error('Exact value must be non-negative');
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}
