import { xdr, StrKey, Address } from '@stellar/stellar-sdk';

export class AuthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthVerificationError';
  }
}

export interface VerifyAuthEntryOptions {
  authEntryBase64: string;
  expectedContractId: string;
  expectedPayTo: string;
  expectedFrom: string;
  minAmount: bigint;
  currentLedger: number;
}

export interface VerifyAuthEntryResult {
  valid: true;
  amount: bigint;
  expirationLedger: number;
}

/**
 * Decode and validate a SorobanAuthorizationEntry (local XDR inspection only).
 * Throws AuthVerificationError if any check fails.
 */
export async function verifyAuthEntry(
  opts: VerifyAuthEntryOptions
): Promise<VerifyAuthEntryResult> {
  const { authEntryBase64, expectedContractId, expectedPayTo, expectedFrom, minAmount, currentLedger } = opts;

  let entry: xdr.SorobanAuthorizationEntry;
  try {
    entry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, 'base64');
  } catch {
    throw new AuthVerificationError('Invalid auth entry XDR');
  }

  const credentials = entry.credentials();
  if (credentials.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
    throw new AuthVerificationError('Auth entry must use address credentials');
  }
  const addrCreds = credentials.address();
  const expirationLedger = addrCreds.signatureExpirationLedger();
  if (expirationLedger <= currentLedger) {
    throw new AuthVerificationError(
      `Auth entry expired: ledger ${expirationLedger} <= current ${currentLedger}`
    );
  }

  const invocation = entry.rootInvocation();
  const fn = invocation.function();
  if (fn.switch() !== xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()) {
    throw new AuthVerificationError('Auth entry must invoke a contract function');
  }

  const contractArgs = fn.contractFn();

  const actualContractId = StrKey.encodeContract(contractArgs.contractAddress().contractId());
  if (actualContractId !== expectedContractId) {
    throw new AuthVerificationError(
      `Wrong contract: expected ${expectedContractId}, got ${actualContractId}`
    );
  }

  const functionName = contractArgs.functionName().toString();
  if (functionName !== 'transfer') {
    throw new AuthVerificationError(`Wrong function: expected "transfer", got "${functionName}"`);
  }

  const args = contractArgs.args();
  if (args.length !== 3) {
    throw new AuthVerificationError(`Expected 3 args, got ${args.length}`);
  }

  const fromAddr = Address.fromScVal(args[0]).toString();
  if (fromAddr !== expectedFrom) {
    throw new AuthVerificationError(`Wrong from: expected ${expectedFrom}, got ${fromAddr}`);
  }

  const toAddr = Address.fromScVal(args[1]).toString();
  if (toAddr !== expectedPayTo) {
    throw new AuthVerificationError(`Wrong payTo: expected ${expectedPayTo}, got ${toAddr}`);
  }

  if (args[2].switch() !== xdr.ScValType.scvI128()) {
    throw new AuthVerificationError('Amount must be i128');
  }
  const i128 = args[2].i128();
  const amount = BigInt(i128.lo().toString()) + (BigInt(i128.hi().toString()) << 64n);
  if (amount < minAmount) {
    throw new AuthVerificationError(`Amount too low: ${amount} < required ${minAmount}`);
  }

  return { valid: true, amount, expirationLedger };
}
