import { describe, it, expect } from "vitest"
import { xdr, StrKey, Keypair, nativeToScVal, Address } from "@stellar/stellar-sdk"
import { verifyAuthEntry, AuthVerificationError } from "../stellar/verify-auth.js"

const USDC_CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const PAYER_KP = Keypair.random()
const PAYER = PAYER_KP.publicKey()
const PAY_TO_KP = Keypair.random()
const PAY_TO = PAY_TO_KP.publicKey()
const CURRENT_LEDGER = 1_000_000
const EXPIRY_LEDGER = 2_000_000

function buildAuthEntry(opts: {
  contractId?: string
  functionName?: string
  from?: string
  to?: string
  amount?: bigint
  expirationLedger?: number
}): string {
  const {
    contractId = USDC_CONTRACT,
    functionName = "transfer",
    from = PAYER,
    to = PAY_TO,
    amount = 1_000_000n,
    expirationLedger = EXPIRY_LEDGER,
  } = opts

  const contractIdBytes = StrKey.decodeContract(contractId) as unknown as xdr.Hash
  const contractAddr = xdr.ScAddress.scAddressTypeContract(contractIdBytes)

  const fromScVal = new Address(from).toScVal()
  const toScVal = new Address(to).toScVal()
  const amountScVal = nativeToScVal(amount, { type: "i128" })

  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: contractAddr,
        functionName,
        args: [fromScVal, toScVal, amountScVal],
      }),
    ),
    subInvocations: [],
  })

  const fromBytes = StrKey.decodeEd25519PublicKey(from)
  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: xdr.ScAddress.scAddressTypeAccount(xdr.PublicKey.publicKeyTypeEd25519(fromBytes)),
        nonce: xdr.Int64.fromString("0"),
        signatureExpirationLedger: expirationLedger,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  })

  return entry.toXDR("base64")
}

describe("verifyAuthEntry", () => {
  it("returns ok for valid auth entry", async () => {
    const result = await verifyAuthEntry({
      authEntryBase64: buildAuthEntry({}),
      expectedContractId: USDC_CONTRACT,
      expectedPayTo: PAY_TO,
      expectedFrom: PAYER,
      minAmount: 1_000_000n,
      currentLedger: CURRENT_LEDGER,
    })
    expect(result.valid).toBe(true)
    expect(result.amount).toBe(1_000_000n)
  })

  it("rejects wrong contract ID", async () => {
    const fakeContractId = StrKey.encodeContract(Buffer.alloc(32, 1))
    await expect(
      verifyAuthEntry({
        authEntryBase64: buildAuthEntry({ contractId: fakeContractId }),
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      }),
    ).rejects.toThrow(AuthVerificationError)
  })

  it("rejects wrong function name", async () => {
    await expect(
      verifyAuthEntry({
        authEntryBase64: buildAuthEntry({ functionName: "approve" }),
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      }),
    ).rejects.toThrow(AuthVerificationError)
  })

  it("rejects amount below minimum", async () => {
    await expect(
      verifyAuthEntry({
        authEntryBase64: buildAuthEntry({ amount: 500_000n }),
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      }),
    ).rejects.toThrow(AuthVerificationError)
  })

  it("rejects expired ledger", async () => {
    await expect(
      verifyAuthEntry({
        authEntryBase64: buildAuthEntry({ expirationLedger: CURRENT_LEDGER - 1 }),
        expectedContractId: USDC_CONTRACT,
        expectedPayTo: PAY_TO,
        expectedFrom: PAYER,
        minAmount: 1_000_000n,
        currentLedger: CURRENT_LEDGER,
      }),
    ).rejects.toThrow(AuthVerificationError)
  })
})
