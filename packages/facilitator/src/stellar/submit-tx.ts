import {
  Keypair,
  Transaction,
  TransactionBuilder,
  Networks,
  rpc,
  xdr,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
} from '@stellar/stellar-sdk';
import type { StellarNetwork } from '../types.js';
import { getRpcServer } from './client.js';

const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

export interface SubmitTxOptions {
  /** The pre-signed SorobanAuthorizationEntry XDR (base64) from the client */
  authEntryBase64: string;
  /** C... contract address of the token */
  contractId: string;
  /** G... address of the payer (client) */
  from: string;
  /** G... address of the recipient (API provider) */
  payTo: string;
  /** Amount in stroops (bigint) */
  amount: bigint;
  /** Facilitator keypair — pays the fee */
  facilitatorKeypair: Keypair;
  network: StellarNetwork;
}

export interface SubmitTxResult {
  txHash: string;
}

/** Build, submit, and poll a Soroban token.transfer using a pre-authorized auth entry. */
export async function submitTx(opts: SubmitTxOptions): Promise<SubmitTxResult> {
  const { authEntryBase64, contractId, from, payTo, amount, facilitatorKeypair, network } = opts;

  const server = getRpcServer(network);
  const networkPassphrase = NETWORK_PASSPHRASE[network];

  // Load facilitator account (needs sequence number)
  const facilitatorAccount = await server.getAccount(facilitatorKeypair.publicKey());

  // Build the token.transfer invocation
  const contract = new Contract(contractId);
  const fromScVal = new Address(from).toScVal();
  const toScVal = new Address(payTo).toScVal();
  const amountScVal = nativeToScVal(amount, { type: 'i128' });

  const callOp = contract.call('transfer', fromScVal, toScVal, amountScVal);

  const tx = new TransactionBuilder(facilitatorAccount, {
    fee: String(Number(BASE_FEE) * 10), // 10x base fee for priority
    networkPassphrase,
  })
    .addOperation(callOp)
    .setTimeout(30)
    .build();

  // Simulate to get resource estimates
  const simResult = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error(`Simulation failed: ${JSON.stringify(simResult)}`);
  }

  // Assemble the transaction with simulation data (sets Soroban resource fees, footprint, etc.)
  const assembled = rpc.assembleTransaction(tx, simResult).build();

  // Decode the client's pre-authorized auth entry
  const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, 'base64');

  // Inject client's auth entry into the assembled tx (replace simulation auth with client's signed auth)
  const txEnvelope = assembled.toEnvelope();
  txEnvelope
    .v1()
    .tx()
    .operations()[0]
    .body()
    .invokeHostFunctionOp()
    .auth([authEntry]);

  // Rebuild Transaction from the mutated envelope so signing works correctly
  const finalTx = new Transaction(txEnvelope, networkPassphrase);
  finalTx.sign(facilitatorKeypair);

  // Submit
  const sendResult = await server.sendTransaction(finalTx);
  if (sendResult.status === 'ERROR') {
    const errDetail = sendResult.errorResult
      ? JSON.stringify(sendResult.errorResult)
      : 'unknown error';
    throw new Error(`Transaction rejected: ${errDetail}`);
  }

  const txHash = sendResult.hash;

  // Poll for confirmation
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS));
    const getResult = await server.getTransaction(txHash);

    if (getResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { txHash };
    }
    if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain: ${txHash}`);
    }
    // NOT_FOUND = still pending, keep polling
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts: ${txHash}`);
}
