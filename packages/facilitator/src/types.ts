/** Network identifier */
export type StellarNetwork = "testnet" | "mainnet"

/** Scheme identifier — always "x402" for this protocol */
export type PaymentScheme = "x402"

/** Asset identifier on Stellar */
export interface AssetInfo {
  code: string // e.g. "USDC"
  issuer: string // G... address of issuer (empty for native XLM)
  contractId: string // C... Soroban token contract address
}

/**
 * PaymentRequirements — returned in 402 response by sdk-server.
 * Tells the client what to sign and where to send payment.
 */
export interface PaymentRequirements {
  scheme: PaymentScheme
  network: StellarNetwork
  maxAmountRequired: string // decimal string, e.g. "0.001"
  asset: AssetInfo
  payTo: string // G... Stellar address of the API provider
  facilitatorUrl: string // URL of this facilitator
  maxLedgerOffset: number // how many ledgers ahead client should set expiry
}

/**
 * PaymentPayload — what the client includes in X-PAYMENT header (base64-encoded JSON).
 */
export interface PaymentPayload {
  scheme: PaymentScheme
  network: StellarNetwork
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntry: string
  /** G... address of the payer (client's Stellar account) */
  from: string
}

/**
 * SettlementReceipt — returned after a successful /settle.
 */
export interface SettlementReceipt {
  txHash: string
  network: StellarNetwork
  settledAt: string // ISO 8601
  amount: string // amount transferred (decimal string)
  fee: string // Kova fee taken (decimal string)
}

/** POST /verify request body */
export interface VerifyRequest {
  payload: PaymentPayload
  requirements: PaymentRequirements
}

/** POST /verify response body */
export interface VerifyResponse {
  valid: boolean
  error?: string
}

/** POST /settle request body */
export interface SettleRequest {
  payload: PaymentPayload
  requirements: PaymentRequirements
}

/** POST /settle response body */
export interface SettleResponse {
  success: boolean
  receipt?: SettlementReceipt
  error?: string
}

/** GET /supported response body */
export interface SupportedResponse {
  schemes: PaymentScheme[]
  networks: StellarNetwork[]
  assets: Record<StellarNetwork, AssetInfo[]>
}
