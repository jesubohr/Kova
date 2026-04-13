import { describe, it, expect } from "vitest"
import { parsePriceToDollars, matchRoute } from "../utils.js"
import type { RouteConfig } from "../config.js"

describe("parsePriceToDollars", () => {
  it('parses $0.001 to "0.001"', () => {
    expect(parsePriceToDollars("$0.001")).toBe("0.001")
  })

  it('parses $1 to "1"', () => {
    expect(parsePriceToDollars("$1")).toBe("1")
  })

  it('parses $0.50 to "0.50"', () => {
    expect(parsePriceToDollars("$0.50")).toBe("0.50")
  })

  it('parses plain "0.001" without $ sign to "0.001"', () => {
    expect(parsePriceToDollars("0.001")).toBe("0.001")
  })

  it("throws on empty string", () => {
    expect(() => parsePriceToDollars("")).toThrow()
  })

  it("throws on non-numeric string", () => {
    expect(() => parsePriceToDollars("$abc")).toThrow()
  })
})

describe("matchRoute", () => {
  const routes: RouteConfig[] = [
    { method: "GET", path: "/api/weather", price: "$0.001" },
    { method: "POST", path: "/api/data", price: "$0.01" },
  ]

  it("matches exact method and path", () => {
    const match = matchRoute("GET", "/api/weather", routes)
    expect(match).toEqual(routes[0])
  })

  it("matches case-insensitively on method", () => {
    const match = matchRoute("get", "/api/weather", routes)
    expect(match).toEqual(routes[0])
  })

  it("returns undefined for non-matching path", () => {
    const match = matchRoute("GET", "/api/unknown", routes)
    expect(match).toBeUndefined()
  })

  it("returns undefined for non-matching method", () => {
    const match = matchRoute("DELETE", "/api/weather", routes)
    expect(match).toBeUndefined()
  })

  it("returns undefined for empty routes", () => {
    const match = matchRoute("GET", "/api/weather", [])
    expect(match).toBeUndefined()
  })
})
