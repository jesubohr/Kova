import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../wallet/stellar.js", () => ({
  createStellarWallet: vi.fn(),
}));
vi.mock("../x402/parse-402.js", () => ({
  parse402Response: vi.fn(),
  Parse402Error: class extends Error {
    name = "Parse402Error";
  },
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
import type { PaymentRequirements, PaymentPayload } from "../x402/types.js";

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

const PAYLOAD: PaymentPayload = {
  scheme: "x402",
  network: "testnet",
  authEntry: "signed_xdr_base64",
  from: "GFROM...",
};

describe("KovaClient", () => {
  let mockWallet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet = {
      publicKey: "GFROM...",
      signAuthEntry: vi.fn().mockResolvedValue({
        authEntryBase64: "signed_xdr_base64",
        publicKey: "GFROM...",
      }),
    };
    vi.mocked(createStellarWallet).mockReturnValue(mockWallet);
    vi.mocked(parse402Response).mockReturnValue(REQUIREMENTS);
    vi.mocked(buildPaymentPayload).mockReturnValue(PAYLOAD);
    vi.mocked(decimalToStroops).mockReturnValue(10_000n);
    vi.mocked(encodePaymentHeader).mockReturnValue("base64encodedpayment");
  });

  it("passes through non-402 responses without payment", async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true });

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const res = await client.fetch("https://api.example.com/data");

    expect(res.status).toBe(200);
    expect(mockWallet.signAuthEntry).not.toHaveBeenCalled();
  });

  it("auto-pays 402 and retries with X-PAYMENT header", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: REQUIREMENTS,
        }),
    };
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValueOnce(r402).mockResolvedValueOnce(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const res = await client.fetch("https://api.example.com/weather");

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers["X-PAYMENT"]).toBe(
      "base64encodedpayment"
    );
  });

  it("tracks spending after successful payment", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: REQUIREMENTS,
        }),
    };
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValueOnce(r402).mockResolvedValueOnce(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    await client.fetch("https://api.example.com/weather");

    const spending = client.getSpending();
    expect(spending.requestsCount).toBe(1);
    expect(spending.totalSpent).toBe("0.001");
  });

  it("throws BudgetExceededError when maxPerRequest exceeded", async () => {
    const r402 = {
      status: 402,
      ok: false,
      json: () =>
        Promise.resolve({
          error: "payment_required",
          requirements: { ...REQUIREMENTS, maxAmountRequired: "0.01" },
        }),
    };
    mockFetch.mockResolvedValue(r402);
    vi.mocked(parse402Response).mockReturnValue({
      ...REQUIREMENTS,
      maxAmountRequired: "0.01",
    });
    vi.mocked(decimalToStroops)
      .mockReturnValueOnce(100_000n) // requested = 0.01 (first call)
      .mockReturnValueOnce(50_000n); // limit = 0.005 (second call)

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
      budget: { maxPerRequest: "0.005" },
    });

    await expect(
      client.fetch("https://api.example.com/expensive")
    ).rejects.toThrow(BudgetExceededError);
  });

  it("fetchAll sends concurrent requests", async () => {
    const r200 = { status: 200, ok: true };
    mockFetch.mockResolvedValue(r200);

    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const results = await client.fetchAll([
      "https://api.example.com/a",
      "https://api.example.com/b",
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(200);
  });

  it("getSpending returns zeroes before any requests", () => {
    const client = new KovaClient({
      stellarSecret: "STEST...",
      network: "testnet",
    });
    const spending = client.getSpending();
    expect(spending.totalSpent).toBe("0");
    expect(spending.requestsCount).toBe(0);
    expect(spending.lastPayment).toBeNull();
  });
});
