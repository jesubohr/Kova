import type { KovaServerOptions, RouteConfig } from '../config.js';
import type { AssetInfo, PaymentRequiredBody } from './types.js';
import { parsePriceToDollars } from '../utils.js';

/** Default USDC addresses per network (mirrors facilitator/tokens.ts) */
const USDC_ASSETS: Record<string, AssetInfo> = {
  testnet: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
  mainnet: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    contractId: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
};

const DEFAULT_MAX_LEDGER_OFFSET = 12;

/**
 * Build the HTTP 402 response body for a protected route.
 */
export function buildPaymentRequired(
  route: RouteConfig,
  options: KovaServerOptions,
): PaymentRequiredBody {
  const asset = options.asset ?? USDC_ASSETS[options.network];
  const maxLedgerOffset = options.maxLedgerOffset ?? DEFAULT_MAX_LEDGER_OFFSET;

  return {
    error: 'payment_required',
    requirements: {
      scheme: 'x402',
      network: options.network,
      maxAmountRequired: parsePriceToDollars(route.price),
      asset,
      payTo: options.payTo,
      facilitatorUrl: options.facilitatorUrl,
      maxLedgerOffset,
    },
  };
}
