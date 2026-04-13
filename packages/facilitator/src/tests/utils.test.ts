import { describe, it, expect } from "vitest"
import { decimalToStroops } from "../utils.js"

describe("decimalToStroops", () => {
  it("converts 1 USDC to 10_000_000 stroops", () => {
    expect(decimalToStroops("1")).toBe(10_000_000n)
  })

  it("converts 0.001 USDC to 10_000 stroops", () => {
    expect(decimalToStroops("0.001")).toBe(10_000n)
  })

  it("converts 0.0000001 USDC to 1 stroop", () => {
    expect(decimalToStroops("0.0000001")).toBe(1n)
  })

  it("converts 0.5 USDC", () => {
    expect(decimalToStroops("0.5")).toBe(5_000_000n)
  })
})
