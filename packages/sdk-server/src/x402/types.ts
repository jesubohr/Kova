/** Network identifier */
export type StellarNetwork = 'testnet' | 'mainnet';

/** Scheme identifier */
export type PaymentScheme = 'x402';

/** Asset descriptor */
export interface AssetInfo {
  code: string;
  issuer: string;
  contractId: string;
}

/**
 * PaymentRequirements — included in HTTP 402 response body.
 * Tells the client what to sign and where to send payment.
 */
export interface PaymentRequirements {
  scheme: PaymentScheme;
  network: StellarNetwork;
  maxAmountRequired: string;
  asset: AssetInfo;
  payTo: string;
  facilitatorUrl: string;
  maxLedgerOffset: number;
}

/**
 * PaymentPayload — decoded from the X-PAYMENT header (base64 JSON).
 */
export interface PaymentPayload {
  scheme: PaymentScheme;
  network: StellarNetwork;
  authEntry: string;
  from: string;
}

/** Body sent to facilitator POST /verify */
export interface VerifyRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** Response from facilitator POST /verify */
export interface VerifyResponse {
  valid: boolean;
  error?: string;
}

/** Body sent to facilitator POST /settle */
export interface SettleRequest {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
}

/** Response from facilitator POST /settle */
export interface SettleResponse {
  success: boolean;
  receipt?: {
    txHash: string;
    network: StellarNetwork;
    settledAt: string;
    amount: string;
    fee: string;
  };
  error?: string;
}

/** The full HTTP 402 response body shape */
export interface PaymentRequiredBody {
  error: 'payment_required';
  requirements: PaymentRequirements;
}
