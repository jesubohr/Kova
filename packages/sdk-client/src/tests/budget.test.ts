import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../wallet/stellar.js", () => ({
  createStellarWallet: vi.fn(),
}));
vi.mock("../x402/parse-402.js", () => ({
  parse402Response: vi.fn(),
  Parse402Error: class extends Error {},
}));
vi.mock("../x402/build-payment.js", () => ({
  buildPaymentPayload: vi.fn(),
}));
vi.mock("../utils.js", () => ({
  decimalToStroops: vi.fn(),
  encodePaymentHeader: vi.fn(),
}));

import { KovaClient, BudgetExceededError } from "../client.js";
import { createStellarWallet } from "../wallet/stellar.js";
import { parse402Response } from "../x402/parse-402.js";
import { buildPaymentPayload } from "../x402/build-payment.js";
import { decimalToStroops, encodePaymentHeader } from "../utils.js";
import type { PaymentRequirements } from "../x402/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const REQUIREMENTS: PaymentRequirements = {
  scheme: "x402",
  network: "testnet",
  maxAmountRequired: "0.001",
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  facilitatorUrl: "http://localhost:4021",
  maxLedgerOffset: 12,
};

function setupMocks() {
  const mockWallet = {
    publicKey: "GFROM...",
    signAuthEntry: vi.fn().mockResolvedValue({
      authEntryBase64: "signed_xdr_base64",
      publicKey: "GFROM...",
    }),
  };
  vi.mocked(createStellarWallet).mockReturnValue(mockWallet);
  vi.mocked(parse402Response).mockReturnValue(REQUIREMENTS);
  vi.mocked(buildPaymentPayload).mockReturnValue({
    scheme: "x402",
    network: "testnet",
    authEntry: "signed_xdr_base64",
    from: "GFROM...",
  });
  vi.mocked(encodePaymentHeader).mockReturnValue("encoded");
  return mockWallet;
}

describe("BudgetExceededError", () => {
  it("includes limitType, limit, and requested in message", () => {
    const err = new BudgetExceededError("maxPerRequest", "0.005", "0.01");
    expect(err.name).toBe("BudgetExceededError");
    expect(err.limitType).toBe("maxPerRequest");
    expect(err.limit).toBe("0.005");
    expect(err.requested).toBe("0.01");
    expect(err.message).toContain("maxPerRequest");
  });
});

describe("KovaClient budget — onBudgetExceeded callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invokes onBudgetExceeded callback before throwing", async () => {
    setupMocks();
    const highReqs = { ...REQUIREMENTS, maxAmountRequired: "1.0" };
    vi.mocked(parse402Response).mockReturnValue(highReqs);
    vi.mocked(decimalToStroops)
      .mockReturnValueOnce(10_000_000n) // requested = 1.0 (first call)
      .mockReturnValueOnce(50_000n); // limit = 0.005 (second call)

    mockFetch.mockResolvedValue({
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: highReqs,
        }),
    });

    const onBudgetExceeded = vi.fn();
    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
      budget: { maxPerRequest: "0.005", onBudgetExceeded },
    });

    await expect(
      client.fetch("https://api.example.com/expensive")
    ).rejects.toThrow(BudgetExceededError);

    expect(onBudgetExceeded).toHaveBeenCalledWith({
      limit: "0.005",
      requested: "1.0",
      type: "maxPerRequest",
    });
  });
});
