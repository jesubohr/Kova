import { describe, it, expect, vi, beforeEach } from "vitest"
import { Keypair, xdr, StrKey, Address } from "@stellar/stellar-sdk"

// Mock rpc.Server to avoid real network calls
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const mod = (await importOriginal()) as any
  return {
    ...mod,
    rpc: {
      ...mod.rpc,
      Server: vi.fn(),
    },
  }
})

import { createStellarWallet } from "../wallet/stellar.js"

const TEST_KP = Keypair.random()
const TEST_SECRET = TEST_KP.secret()
const TEST_PUBLIC = TEST_KP.publicKey()
const USDC_CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const PAY_TO = Keypair.random().publicKey()
const CURRENT_LEDGER = 1_000_000

describe("createStellarWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns correct publicKey from secret", () => {
    const wallet = createStellarWallet({
      stellarSecret: TEST_SECRET,
      network: "testnet",
    })
    expect(wallet.publicKey).toBe(TEST_PUBLIC)
  })

  it("signAuthEntry produces valid base64 XDR", async () => {
    const mockGetLatestLedger = vi.fn().mockResolvedValue({ sequence: CURRENT_LEDGER })
    const { rpc } = await import("@stellar/stellar-sdk")
    vi.mocked(rpc.Server).mockImplementation(function () {
      return { getLatestLedger: mockGetLatestLedger }
    } as any)

    const wallet = createStellarWallet({
      stellarSecret: TEST_SECRET,
      network: "testnet",
    })

    const result = await wallet.signAuthEntry({
      contractId: USDC_CONTRACT,
      payTo: PAY_TO,
      amount: 10_000n,
      maxLedgerOffset: 12,
    })

    expect(result.publicKey).toBe(TEST_PUBLIC)
    expect(result.authEntryBase64).toBeTruthy()

    // Decode and verify structure matches what facilitator expects
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(result.authEntryBase64, "base64")
    const creds = entry.credentials()
    expect(creds.switch()).toEqual(xdr.SorobanCredentialsType.sorobanCredentialsAddress())

    const addrCreds = creds.address()
    expect(addrCreds.signatureExpirationLedger()).toBe(CURRENT_LEDGER + 12)

    const invocation = entry.rootInvocation()
    const contractFn = invocation.function().contractFn()
    const actualContractId = StrKey.encodeContract(contractFn.contractAddress().contractId())
    expect(actualContractId).toBe(USDC_CONTRACT)
    expect(contractFn.functionName().toString()).toBe("transfer")

    const args = contractFn.args()
    expect(args.length).toBe(3)
    expect(Address.fromScVal(args[0]).toString()).toBe(TEST_PUBLIC)
    expect(Address.fromScVal(args[1]).toString()).toBe(PAY_TO)
  })

  it("throws if stellarSecret is invalid", () => {
    expect(() => createStellarWallet({ stellarSecret: "INVALID", network: "testnet" })).toThrow()
  })
})
