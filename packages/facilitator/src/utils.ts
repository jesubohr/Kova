/**
 * Convert a decimal string like "0.001" to Stellar stroops (bigint, 7 decimals).
 * e.g. "0.001" → 10_000n, "1" → 10_000_000n
 */
export function decimalToStroops(decimal: string): bigint {
  const [whole, frac = ''] = decimal.split('.');
  const fracPadded = frac.padEnd(7, '0').slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}
