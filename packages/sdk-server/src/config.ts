import type { StellarNetwork, AssetInfo } from './x402/types.js';

/** Configuration for a single protected route */
export interface RouteConfig {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Route path pattern (e.g. '/api/weather') */
  path: string;
  /** Price as dollar string (e.g. '$0.001') */
  price: string;
  /** Human-readable description of the endpoint */
  description?: string;
}

/** Options passed to kovaPlugin / kovaMiddleware */
export interface KovaServerOptions {
  /** API key for authenticating with the Kova dashboard (unused by middleware, forwarded in headers) */
  apiKey?: string;
  /** Facilitator service URL (e.g. 'http://localhost:4021') */
  facilitatorUrl: string;
  /** Stellar address to receive payments (G... format) */
  payTo: string;
  /** Stellar network to use */
  network: StellarNetwork;
  /** Protected routes configuration */
  routes: RouteConfig[];
  /** Asset to accept — defaults to USDC on the chosen network */
  asset?: AssetInfo;
  /** Max ledger offset for auth entry expiry — defaults to 12 */
  maxLedgerOffset?: number;
}
