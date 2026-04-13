import { describe, it, expect } from "vitest"

describe("config validation", () => {
  it("require() throws on missing env var", () => {
    function requireEnv(name: string): string {
      const val = process.env[name]
      if (!val) throw new Error(`Missing required env var: ${name}`)
      return val
    }

    delete process.env["__TEST_MISSING__"]
    expect(() => requireEnv("__TEST_MISSING__")).toThrow("__TEST_MISSING__")
  })

  it("optional() returns fallback when env var missing", () => {
    function optionalEnv(name: string, fallback: string): string {
      return process.env[name] ?? fallback
    }

    delete process.env["__TEST_OPTIONAL__"]
    expect(optionalEnv("__TEST_OPTIONAL__", "default")).toBe("default")
  })

  it("config loads with required env vars set", async () => {
    const { config } = await import("../config.js")
    expect(config.stellarSecret).toBe("STEST")
    expect(config.treasuryAddress).toBe("GTEST")
    expect(config.port).toBe(4021)
    expect(config.network).toBe("testnet")
    expect(config.feePercent).toBe(1.5)
  })
})
