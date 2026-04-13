import { describe, it, expect } from "vitest"
import { calculateFee } from "../fee/calculator.js"

describe("calculateFee", () => {
  it("computes 1.5% of amount", () => {
    // 1 USDC = 10_000_000 stroops. 1.5% of 10_000_000 = 150_000
    expect(calculateFee(10_000_000n, 1.5, 1000n)).toBe(150_000n)
  })

  it("applies minimum floor when fee < floor", () => {
    // 1.5% of 1000 = 15, but floor is 1000
    expect(calculateFee(1_000n, 1.5, 1000n)).toBe(1000n)
  })

  it("handles zero amount", () => {
    expect(calculateFee(0n, 1.5, 1000n)).toBe(1000n) // floor applies
  })

  it("rounds down to whole stroop", () => {
    // 1.5% of 10_000_001 = 150_000.015 → 150_000
    expect(calculateFee(10_000_001n, 1.5, 1000n)).toBe(150_000n)
  })
})
