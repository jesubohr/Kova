import { describe, it, expect } from "vitest";
import { parse402Response, Parse402Error } from "../x402/parse-402.js";
import type { PaymentRequiredBody } from "../x402/types.js";

const VALID_BODY: PaymentRequiredBody = {
  error: "payment_required",
  requirements: {
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
  },
};

describe("parse402Response", () => {
  it("extracts PaymentRequirements from valid 402 body", () => {
    const result = parse402Response(VALID_BODY);
    expect(result).toEqual(VALID_BODY.requirements);
  });

  it("throws Parse402Error when error field missing", () => {
    expect(() =>
      parse402Response({ requirements: VALID_BODY.requirements } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when error field wrong value", () => {
    expect(() =>
      parse402Response({
        error: "not_found",
        requirements: VALID_BODY.requirements,
      } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when requirements missing", () => {
    expect(() =>
      parse402Response({ error: "payment_required" } as any)
    ).toThrow(Parse402Error);
  });

  it("throws Parse402Error when scheme is not x402", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, scheme: "other" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when network invalid", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, network: "devnet" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when payTo empty", () => {
    const bad = {
      ...VALID_BODY,
      requirements: { ...VALID_BODY.requirements, payTo: "" },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });

  it("throws Parse402Error when asset.contractId empty", () => {
    const bad = {
      ...VALID_BODY,
      requirements: {
        ...VALID_BODY.requirements,
        asset: { code: "USDC", issuer: "G...", contractId: "" },
      },
    };
    expect(() => parse402Response(bad as any)).toThrow(Parse402Error);
  });
});
