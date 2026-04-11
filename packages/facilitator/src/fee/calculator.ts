/**
 * Calculate Kova fee on a payment amount.
 * All amounts in stroops (bigint, 7 decimal places).
 *
 * @param amount - gross payment amount in stroops
 * @param feePercent - fee percentage, e.g. 1.5 for 1.5%
 * @param floorStroops - minimum fee in stroops
 * @returns fee amount in stroops (at least floorStroops)
 */
export function calculateFee(
  amount: bigint,
  feePercent: number,
  floorStroops: bigint
): bigint {
  const feeRaw = (amount * BigInt(Math.floor(feePercent * 1000))) / 100_000n;
  return feeRaw < floorStroops ? floorStroops : feeRaw;
}
