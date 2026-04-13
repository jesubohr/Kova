import type { RouteConfig } from "./config.js"

/**
 * Parse a price string like '$0.001' or '0.001' to a plain decimal string.
 * Strips the leading '$' if present, validates the result is a finite number.
 */
export function parsePriceToDollars(price: string): string {
  const stripped = price.startsWith("$") ? price.slice(1) : price
  if (stripped === "" || isNaN(Number(stripped)) || !isFinite(Number(stripped))) {
    throw new Error(`Invalid price: "${price}"`)
  }
  return stripped
}

/**
 * Find the RouteConfig matching a request's method and path.
 * Returns undefined if no route matches (request is not protected).
 */
export function matchRoute(method: string, path: string, routes: RouteConfig[]): RouteConfig | undefined {
  const upperMethod = method.toUpperCase()
  return routes.find((r) => r.method.toUpperCase() === upperMethod && r.path === path)
}
