import {
  Keypair,
  xdr,
  StrKey,
  Address,
  Networks,
  nativeToScVal,
  authorizeInvocation,
  rpc,
} from "@stellar/stellar-sdk";
import type { WalletConfig, SignedAuthEntry } from "./types.js";
import type { StellarNetwork } from "../x402/types.js";

const RPC_URLS: Record<StellarNetwork, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban.stellar.org",
};

const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

export interface SignAuthEntryOptions {
  contractId: string;
  payTo: string;
  amount: bigint;
  maxLedgerOffset: number;
}

export interface StellarWallet {
  publicKey: string;
  signAuthEntry(opts: SignAuthEntryOptions): Promise<SignedAuthEntry>;
}

/**
 * Create a Stellar wallet from a secret key.
 * Provides auth entry signing for Soroban token.transfer invocations.
 */
export function createStellarWallet(config: WalletConfig): StellarWallet {
  const keypair = Keypair.fromSecret(config.stellarSecret);
  const publicKey = keypair.publicKey();
  const networkPassphrase = NETWORK_PASSPHRASE[config.network];
  const server = new rpc.Server(RPC_URLS[config.network], {
    allowHttp: false,
  });

  async function signAuthEntry(
    opts: SignAuthEntryOptions
  ): Promise<SignedAuthEntry> {
    const { contractId, payTo, amount, maxLedgerOffset } = opts;

    // Get current ledger from Soroban RPC
    const { sequence: currentLedger } = await server.getLatestLedger();
    const validUntil = currentLedger + maxLedgerOffset;

    // Build invocation tree for token.transfer(from, to, amount)
    const contractIdBytes = StrKey.decodeContract(contractId);
    const contractAddr = xdr.ScAddress.scAddressTypeContract(contractIdBytes);

    const fromScVal = new Address(publicKey).toScVal();
    const toScVal = new Address(payTo).toScVal();
    const amountScVal = nativeToScVal(amount, { type: "i128" });

    const invocation = new xdr.SorobanAuthorizedInvocation({
      function:
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: contractAddr,
            functionName: "transfer",
            args: [fromScVal, toScVal, amountScVal],
          })
        ),
      subInvocations: [],
    });

    // authorizeInvocation builds full SorobanAuthorizationEntry with
    // address credentials, nonce, expiration, and Ed25519 signature
    const entry = await authorizeInvocation(
      keypair,
      validUntil,
      invocation,
      undefined,
      networkPassphrase
    );

    return {
      authEntryBase64: entry.toXDR("base64"),
      publicKey,
    };
  }

  return { publicKey, signAuthEntry };
}
