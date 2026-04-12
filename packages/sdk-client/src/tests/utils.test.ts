import { describe, it, expect } from "vitest";
import {
  decimalToStroops,
  encodePaymentHeader,
  decodePaymentHeader,
} from "../utils.js";
import type { PaymentPayload } from "../x402/types.js";

describe("decimalToStroops", () => {
  it("converts '0.001' to 10_000n", () => {
    expect(decimalToStroops("0.001")).toBe(10_000n);
  });

  it("converts '1' to 10_000_000n", () => {
    expect(decimalToStroops("1")).toBe(10_000_000n);
  });

  it("converts '0.1234567' to 1_234_567n", () => {
    expect(decimalToStroops("0.1234567")).toBe(1_234_567n);
  });

  it("truncates beyond 7 decimal places", () => {
    expect(decimalToStroops("0.12345678")).toBe(1_234_567n);
  });

  it("converts '100.5' to 1_005_000_000n", () => {
    expect(decimalToStroops("100.5")).toBe(1_005_000_000n);
  });
});

describe("encodePaymentHeader / decodePaymentHeader", () => {
  const payload: PaymentPayload = {
    scheme: "x402",
    network: "testnet",
    authEntry: "base64xdr==",
    from: "GABC1234567890123456789012345678901234567890123456789012",
  };

  it("round-trips a PaymentPayload through base64", () => {
    const encoded = encodePaymentHeader(payload);
    const decoded = decodePaymentHeader(encoded);
    expect(decoded).toEqual(payload);
  });

  it("returns null for invalid base64", () => {
    expect(decodePaymentHeader("not-valid!!!")).toBeNull();
  });

  it("returns null for valid base64 but invalid JSON", () => {
    const notJson = Buffer.from("not json").toString("base64");
    expect(decodePaymentHeader(notJson)).toBeNull();
  });
});
