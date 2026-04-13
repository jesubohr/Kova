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
} from "@stellar/stellar-sdk"
import type { StellarNetwork } from "../types.js"
import { getRpcServer } from "./client.js"

const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40

// Per-account mutex: prevents txBadSeq when concurrent requests race on the same
// facilitator account. Each new caller chains onto the tail of the queue; the lock
// is released after sendTransaction (not after polling) so throughput is not blocked
// by the 20×3 s confirmation wait.
const accountMutexes = new Map<string, Promise<void>>()

function withAccountLock<T>(publicKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = accountMutexes.get(publicKey) ?? Promise.resolve()
  let release!: () => void
  const slot = new Promise<void>((r) => {
    release = r
  })
  accountMutexes.set(publicKey, slot)
  // prev.then ensures serial execution; finally(release) unblocks the next waiter
  // even when fn() throws, so a single failure never deadlocks the queue.
  return prev.then(() => fn()).finally(release)
}

export interface SubmitTxOptions {
  /** The pre-signed SorobanAuthorizationEntry XDR (base64) from the client */
  authEntryBase64: string
  /** C... contract address of the token */
  contractId: string
  /** G... address of the payer (client) */
  from: string
  /** G... address of the recipient (API provider) */
  payTo: string
  /** Amount in stroops (bigint) */
  amount: bigint
  /** Facilitator keypair — pays the fee */
  facilitatorKeypair: Keypair
  network: StellarNetwork
}

export interface SubmitTxResult {
  txHash: string
}

/** Build, submit, and poll a Soroban token.transfer using a pre-authorized auth entry. */
export async function submitTx(opts: SubmitTxOptions): Promise<SubmitTxResult> {
  const { authEntryBase64, contractId, from, payTo, amount, facilitatorKeypair, network } = opts

  const server = getRpcServer(network)
  const networkPassphrase = NETWORK_PASSPHRASE[network]

  const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, "base64")

  const contract = new Contract(contractId)
  const fromScVal = new Address(from).toScVal()
  const toScVal = new Address(payTo).toScVal()
  const amountScVal = nativeToScVal(amount, { type: "i128" })
  const callOp = contract.call("transfer", fromScVal, toScVal, amountScVal)

  // Hold the account lock only for getAccount → sendTransaction.
  // Polling happens outside so a 60-second confirmation wait never blocks the next request.
  const txHash = await withAccountLock(facilitatorKeypair.publicKey(), async () => {
    const facilitatorAccount = await server.getAccount(facilitatorKeypair.publicKey())

    const baseTx = new TransactionBuilder(facilitatorAccount, {
      fee: String(Number(BASE_FEE) * 10),
      networkPassphrase,
    })
      .addOperation(callOp)
      .setTimeout(180)
      .build()

    // Inject auth BEFORE simulation so the footprint includes the auth nonce ledger key.
    // toEnvelope() returns a new XDR copy each call — must rebuild Transaction from the
    // mutated envelope, otherwise the simulation receives a tx with no auth.
    const simEnvelope = baseTx.toEnvelope()
    simEnvelope.v1().tx().operations()[0].body().invokeHostFunctionOp().auth([authEntry])
    const txForSim = new Transaction(simEnvelope, networkPassphrase)

    const simResult = await server.simulateTransaction(txForSim)
    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new Error(`Simulation failed: ${JSON.stringify(simResult)}`)
    }

    // assembleTransaction sets Soroban resource fees/footprint but may replace auth
    // with unsigned placeholders — re-inject the signed entry below.
    const assembled = rpc.assembleTransaction(txForSim, simResult).build()

    const txEnvelope = assembled.toEnvelope()
    txEnvelope.v1().tx().operations()[0].body().invokeHostFunctionOp().auth([authEntry])

    const finalTx = new Transaction(txEnvelope, networkPassphrase)
    finalTx.sign(facilitatorKeypair)

    const sendResult = await server.sendTransaction(finalTx)
    if (sendResult.status === "ERROR") {
      const errDetail = sendResult.errorResult ? JSON.stringify(sendResult.errorResult) : "unknown error"
      throw new Error(`Transaction rejected: ${errDetail}`)
    }
    if (sendResult.status === "TRY_AGAIN_LATER") {
      throw new Error(`Stellar node throttled — transaction not submitted, try again later`)
    }

    return sendResult.hash
  })

  // Poll outside the lock — does not touch the sequence number.
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))
    const getResult = await server.getTransaction(txHash)

    if (getResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { txHash }
    }
    if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      const resultB64 = getResult.resultXdr.toXDR("base64")
      const diagnostics = getResult.diagnosticEventsXdr?.map((e) => e.toXDR("base64")).join(", ")
      const detail = diagnostics ? ` | diagnostics: ${diagnostics}` : ""
      throw new Error(`Transaction failed on-chain: ${txHash} | result: ${resultB64}${detail}`)
    }
    // NOT_FOUND = still pending, keep polling
  }

  throw new Error(`Transaction not confirmed after ${MAX_POLL_ATTEMPTS} attempts: ${txHash}`)
}
