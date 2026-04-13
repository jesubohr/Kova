// Client
export { KovaClient, BudgetExceededError } from "./client.js"
export type { KovaClientOptions, BudgetConfig, SpendingSummary } from "./client.js"

// x402 types (re-exported for consumers)
export type {
  PaymentScheme,
  StellarNetwork,
  AssetInfo,
  PaymentRequirements,
  PaymentPayload,
  PaymentRequiredBody,
} from "./x402/types.js"

// Errors
export { Parse402Error } from "./x402/parse-402.js"

// Wallet types
export type { WalletConfig, SignedAuthEntry } from "./wallet/types.js"
