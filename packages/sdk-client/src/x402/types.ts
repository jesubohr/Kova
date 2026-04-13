/** Network identifier */
export type StellarNetwork = "testnet" | "mainnet"

/** Scheme identifier */
export type PaymentScheme = "x402"

/** Asset descriptor */
export interface AssetInfo {
  code: string
  issuer: string
  contractId: string
}

/** PaymentRequirements — included in HTTP 402 response body */
export interface PaymentRequirements {
  scheme: PaymentScheme
  network: StellarNetwork
  maxAmountRequired: string
  asset: AssetInfo
  payTo: string
  facilitatorUrl: string
  maxLedgerOffset: number
}

/** PaymentPayload — sent in X-PAYMENT header (base64-encoded JSON) */
export interface PaymentPayload {
  scheme: PaymentScheme
  network: StellarNetwork
  /** base64-encoded XDR SorobanAuthorizationEntry */
  authEntry: string
  /** G... address of the payer */
  from: string
}

/** Full HTTP 402 response body shape */
export interface PaymentRequiredBody {
  error: "payment_required"
  requirements: PaymentRequirements
}
